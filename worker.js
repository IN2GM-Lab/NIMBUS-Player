let moduleReady = null;

function initModule() {
  if (moduleReady) return moduleReady;

  // Install the postMessage interceptor BEFORE importScripts (which
  // synchronously sets up the EM_ASM JS-call dispatch).  All EM_ASM
  // postMessage calls from inside the WASM go through this wrapper so we
  // can parse the PLY *inside the worker*, offloading parse cost from
  // the main thread and letting parsing parallelise across the pool.
  installFrameInterceptor();

  moduleReady = new Promise((resolve) => {
    self.Module = {
      locateFile(path) {
        return path;
      },
      onRuntimeInitialized() {
        // Emscripten may not attach HEAP* views to Module; mirror globals.
        self.Module.HEAPU8 = self.HEAPU8;
        self.Module.HEAPU32 = self.HEAPU32;
        resolve(self.Module);
      },
    };
    importScripts("gpcc_decoder.js");
  });

  return moduleReady;
}

// ── In-worker PLY parser (extracted from app.js) ───────────────────────────
const _typeInfo = {
  char:   [1, (dv,o)=>dv.getInt8(o)],   int8:   [1, (dv,o)=>dv.getInt8(o)],
  uchar:  [1, (dv,o)=>dv.getUint8(o)],  uint8:  [1, (dv,o)=>dv.getUint8(o)],
  short:  [2, (dv,o)=>dv.getInt16(o,true)], int16: [2, (dv,o)=>dv.getInt16(o,true)],
  ushort: [2, (dv,o)=>dv.getUint16(o,true)], uint16:[2, (dv,o)=>dv.getUint16(o,true)],
  int:    [4, (dv,o)=>dv.getInt32(o,true)], int32: [4, (dv,o)=>dv.getInt32(o,true)],
  uint:   [4, (dv,o)=>dv.getUint32(o,true)], uint32:[4, (dv,o)=>dv.getUint32(o,true)],
  float:  [4, (dv,o)=>dv.getFloat32(o,true)], float32:[4, (dv,o)=>dv.getFloat32(o,true)],
  double: [8, (dv,o)=>dv.getFloat64(o,true)], float64:[8, (dv,o)=>dv.getFloat64(o,true)],
};

function _findHeaderEnd(data) {
  const enc = new TextEncoder();
  for (const m of [enc.encode('end_header\n'), enc.encode('end_header\r\n')]) {
    outer: for (let i = 0; i <= data.length - m.length; i++) {
      for (let j = 0; j < m.length; j++) if (data[i+j] !== m[j]) continue outer;
      return i + m.length;
    }
  }
  throw new Error('PLY header end not found');
}

function parsePlyInWorker(buffer) {
  const data      = new Uint8Array(buffer);
  const headerEnd = _findHeaderEnd(data);
  const lines     = new TextDecoder().decode(data.slice(0, headerEnd)).split(/\r?\n/);

  let format = 'ascii', vertexCount = 0, inVertex = false;
  const properties = [];
  for (const line of lines) {
    const p = line.trim().split(/\s+/);
    if (p[0]==='format')  { format = p[1]; }
    else if (p[0]==='element') {
      inVertex = p[1]==='vertex'; if (inVertex) vertexCount = parseInt(p[2],10);
    } else if (p[0]==='property' && inVertex) {
      if (p[1]==='list') properties.push({name:p[4],type:'list',countType:p[2],itemType:p[3]});
      else               properties.push({name:p[2],type:p[1]});
    }
  }

  const hasColor  = properties.some(p => p.name==='red'||p.name==='green'||p.name==='blue');
  const positions = new Float32Array(vertexCount * 3);
  const colors    = hasColor ? new Uint8Array(vertexCount * 3) : null;

  if (format.startsWith('ascii')) {
    const rows = new TextDecoder().decode(data.slice(headerEnd)).trim().split(/\r?\n/);
    for (let i = 0; i < vertexCount; i++) {
      const vals = rows[i].trim().split(/\s+/);
      let vi = 0, cr=255,cg=255,cb=255;
      for (const prop of properties) {
        if (prop.type==='list') { vi += 1 + parseInt(vals[vi],10); continue; }
        const v = parseFloat(vals[vi++]);
        if (prop.name==='x') positions[i*3]=v;
        else if (prop.name==='y') positions[i*3+1]=v;
        else if (prop.name==='z') positions[i*3+2]=v;
        else if (prop.name==='red')   cr=v;
        else if (prop.name==='green') cg=v;
        else if (prop.name==='blue')  cb=v;
      }
      if (colors) { colors[i*3]=cr; colors[i*3+1]=cg; colors[i*3+2]=cb; }
    }
  } else if (format.includes('binary_little_endian')) {
    const view = new DataView(buffer, headerEnd);
    let off = 0;
    // Fast path: if properties are exactly {x,y,z}+{red,green,blue} with
    // float positions and uchar colours, bulk-copy with hardcoded offsets.
    const isFastLayout =
      properties.length === 6 &&
      properties[0].name==='x' && properties[0].type==='float' &&
      properties[1].name==='y' && properties[1].type==='float' &&
      properties[2].name==='z' && properties[2].type==='float' &&
      properties[3].name==='red'   && properties[3].type==='uchar' &&
      properties[4].name==='green' && properties[4].type==='uchar' &&
      properties[5].name==='blue'  && properties[5].type==='uchar';
    if (isFastLayout) {
      const stride = 15; // 3*4 + 3
      for (let i = 0; i < vertexCount; i++) {
        const base = headerEnd + i*stride;
        positions[i*3]   = view.getFloat32(off, true);   off += 4;
        positions[i*3+1] = view.getFloat32(off, true);   off += 4;
        positions[i*3+2] = view.getFloat32(off, true);   off += 4;
        colors[i*3]   = data[base+12];
        colors[i*3+1] = data[base+13];
        colors[i*3+2] = data[base+14];
        off += 3;
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        let cr=255,cg=255,cb=255;
        for (const prop of properties) {
          if (prop.type==='list') {
            const ci=_typeInfo[prop.countType], ii=_typeInfo[prop.itemType];
            const cnt=ci[1](view,off); off+=ci[0]+cnt*ii[0]; continue;
          }
          const rd=_typeInfo[prop.type];
          const v=rd[1](view,off); off+=rd[0];
          if (prop.name==='x') positions[i*3]=v;
          else if (prop.name==='y') positions[i*3+1]=v;
          else if (prop.name==='z') positions[i*3+2]=v;
          else if (prop.name==='red')   cr=v;
          else if (prop.name==='green') cg=v;
          else if (prop.name==='blue')  cb=v;
        }
        if (colors) { colors[i*3]=cr; colors[i*3+1]=cg; colors[i*3+2]=cb; }
      }
    }
  } else {
    throw new Error('Unsupported PLY format: ' + format);
  }

  return { positions, colors, count: vertexCount, hasColor };
}

function installFrameInterceptor() {
  if (self._postMessagePatched) return;
  self._postMessagePatched = true;
  const orig = self.postMessage.bind(self);
  self.postMessage = function(msg, transfer) {
    if (msg && msg.type === 'frame' && msg.frame instanceof ArrayBuffer) {
      try {
        const _pt0 = performance.now();
        const cloud = parsePlyInWorker(msg.frame);
        self._parseMsAccum = (self._parseMsAccum || 0) + (performance.now() - _pt0);
        const newMsg = {
          type: 'frame',
          id: msg.id, index: msg.index, frameIndex: msg.frameIndex,
          positions: cloud.positions,
          colors:    cloud.colors,
          count:     cloud.count,
          hasColor:  cloud.hasColor,
        };
        const transferList = [cloud.positions.buffer];
        if (cloud.colors) transferList.push(cloud.colors.buffer);
        orig(newMsg, transferList);
        return;
      } catch (e) {
        // Fall back to forwarding the raw PLY if parsing fails.
        orig(msg, transfer || (msg.frame ? [msg.frame] : []));
        return;
      }
    }
    orig(msg, transfer);
  };
}

function readCString(module, ptr) {
  const heap = module.HEAPU8;
  let end = ptr;
  while (heap[end] !== 0) end++;
  return new TextDecoder().decode(heap.subarray(ptr, end));
}

function syncHeaps(module) {
  // Refresh views after any potential memory growth.
  module.HEAPU8 = self.HEAPU8;
  module.HEAPU32 = self.HEAPU32;
}

// Free every file the decoder left behind in MEMFS.  The C++ EM_ASM
// streaming path writes one /tmp/gpcc_out_N.ply per decoded frame and
// never deletes them — over hundreds of frames per worker this exhausts
// the WASM heap (ArrayBuffer allocation failed in expandFileStorage).
function cleanupMemfs(module) {
  const FS = module.FS || self.FS;
  if (!FS) return;
  try {
    const entries = FS.readdir("/tmp");
    for (const name of entries) {
      if (name === "." || name === "..") continue;
      try { FS.unlink("/tmp/" + name); } catch (_) {}
    }
  } catch (_) { /* /tmp may not exist yet */ }
}

self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg) return;

  // Pre-warm: kick off WASM compile + instantiation, then signal readiness
  // so the host can wait for a fully-warm pool instead of guessing a delay.
  if (msg.type === "warmup") {
    initModule().then(() => self.postMessage({ type: "warmed" }));
    return;
  }
  if (msg.type !== "decode") return;

  const module = await initModule();
  syncHeaps(module);
  const input = new Uint8Array(msg.payload);

  const inPtr = module._malloc(input.length);
  syncHeaps(module);
  module.HEAPU8.set(input, inPtr);

  const outPtrPtr = module._malloc(4);
  const outSizePtr = module._malloc(4);
  const errPtrPtr = module._malloc(4);

  syncHeaps(module);
  module.HEAPU32[outPtrPtr >> 2] = 0;
  module.HEAPU32[outSizePtr >> 2] = 0;
  module.HEAPU32[errPtrPtr >> 2] = 0;

  // Expose decode-job context on `self` so EM_ASM inside onOutputCloud can
  // include them in each streamed "frame" postMessage.
  self._gpccDecodeId = msg.id;
  self._gpccDecodeIndex = msg.index;
  // frameIndex base: for single-frame parallel jobs this is the job's slot;
  // for legacy multi-frame whole-bin decode it is 0 and EM_ASM increments.
  self._gpccDecodeFrameIdx = msg.frameIndex !== undefined ? msg.frameIndex : 0;
  self._gpccFrameCount = 0;
  self._parseMsAccum = 0;          // PLY-parse time accumulated by the interceptor

  const _decT0 = performance.now();
  const result = module._gpcc_decode_to_ply(
    inPtr,
    input.length,
    msg.outputBinary ? 1 : 0,
    outPtrPtr,
    outSizePtr,
    errPtrPtr
  );
  const decodeTotalMs = performance.now() - _decT0;

  // _gpccFrameCount was incremented by EM_ASM for each frame posted above.
  const streamedFrameCount = self._gpccFrameCount | 0;

  syncHeaps(module);
  const errPtr = module.HEAPU32[errPtrPtr >> 2];

  // A non-zero return does NOT mean the frame was lost.  The decoder streams
  // every frame to JS from onOutputCloud (EM_ASM) *before* gpcc_decode_to_ply
  // returns; its tail then re-collects them from MEMFS by scanning
  // /tmp/gpcc_out_<n>.ply from n=0.  Those files are named by the frame number
  // carried in the bitstream, so for any payload whose first frame is not
  // frame 0 the scan finds nothing and the call reports "No output frames
  // produced." even though the frame was already delivered.  The streamed
  // frames are the authoritative output: only fail the job if nothing
  // streamed.  (Reporting these as errors also dropped the job's timings,
  // which biased the per-stage decode statistics to frame-0 payloads.)
  if (result !== 0 && streamedFrameCount === 0) {
    const message = errPtr ? readCString(module, errPtr) : "Decode failed";
    if (errPtr) module._gpcc_free(errPtr);
    module._free(inPtr);
    module._free(outPtrPtr);
    module._free(outSizePtr);
    module._free(errPtrPtr);
    cleanupMemfs(module);
    self.postMessage({ type: "error", id: msg.id, index: msg.index, message });
    return;
  }

  syncHeaps(module);
  const outPtr  = module.HEAPU32[outPtrPtr  >> 2];
  const outSize = module.HEAPU32[outSizePtr >> 2];

  if (streamedFrameCount > 0) {
    // All frames were already sent as "frame" messages during decode.
    // Discard the packed C++ buffer — we don't need it.
    if (outPtr) module._gpcc_free(outPtr);
    if (errPtr) module._gpcc_free(errPtr);
    module._free(inPtr);
    module._free(outPtrPtr);
    module._free(outSizePtr);
    module._free(errPtrPtr);
    cleanupMemfs(module);

    // Signal decode completion (frames already delivered).  decoderStatus
    // carries the raw return code so the host can count the benign
    // "no packed output" case described above without losing the frame.
    self.postMessage({ type: "done", id: msg.id, index: msg.index,
                       decodeTotalMs, parseMs: self._parseMsAccum,
                       decoderStatus: result,
                       decoderMessage: (result !== 0 && errPtr)
                         ? readCString(module, errPtr) : undefined });
  } else {
    // Fallback: EM_ASM streaming didn't fire (non-WASM build / error).
    // Unpack the packed C++ buffer sent in outData/outSize.
    const view = new DataView(module.HEAPU8.buffer, outPtr, outSize);
    const frameCount = view.getUint32(0, true);
    const sizes = [];
    for (let i = 0; i < frameCount; i++)
      sizes.push(view.getUint32(4 + i * 4, true));

    let dataOffset = outPtr + 4 + frameCount * 4;
    const frames = sizes.map((sz) => {
      const copy = new Uint8Array(sz);
      copy.set(module.HEAPU8.subarray(dataOffset, dataOffset + sz));
      dataOffset += sz;
      return copy.buffer;
    });

    module._gpcc_free(outPtr);
    if (errPtr) module._gpcc_free(errPtr);
    module._free(inPtr);
    module._free(outPtrPtr);
    module._free(outSizePtr);
    module._free(errPtrPtr);
    cleanupMemfs(module);

    self.postMessage(
      { type: "done", id: msg.id, index: msg.index, frames,
        decodeTotalMs, parseMs: self._parseMsAccum },
      frames
    );
  }
};
