// ── DOM refs ──────────────────────────────────────────────────────────────────
const mpdUrlInput  = document.getElementById('mpdUrl');
// Default MPD URLs point at the public Cloudflare R2 bucket hosting the demo
// content, so the site works from any origin (GitHub Pages, a phone, a laptop)
// with no local content required. Any other MPD URL — including one on a
// different origin — can be typed into the field.
const DEFAULT_MPD_URL = 'https://pub-3bb5b49d671a4ede814989964fc9bd22.r2.dev/octree-longdress/stream.mpd';
if (mpdUrlInput) {
  mpdUrlInput.value = DEFAULT_MPD_URL;
}
// Sequence picker: rewrite the MPD field to the chosen sequence.
const seqSel = document.getElementById('seqSel');
if (seqSel) {
  seqSel.addEventListener('change', () => {
    if (!seqSel.value) return;
    mpdUrlInput.value = seqSel.value;
  });
}
const loadBtn      = document.getElementById('loadBtn');
const stopBtn      = document.getElementById('stopBtn');
const playBtn      = document.getElementById('playBtn');
const canvas       = document.getElementById('glCanvas');
const overlay      = document.getElementById('overlay');
const overlayMsg   = document.getElementById('overlayMsg');
const seekBuf      = document.getElementById('seekBuf');
const seekPlayed   = document.getElementById('seekPlayed');
const seekThumb    = document.getElementById('seekThumb');
const timeDisplay  = document.getElementById('timeDisplay');
const totalTime    = document.getElementById('totalTime');
const mQualityId   = document.getElementById('mQualityId');
const mQualityTier = document.getElementById('mQualityTier');
const mBandwidth   = document.getElementById('mBandwidth');
const qualityBars  = document.getElementById('qualityBars');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const mFrame       = document.getElementById('mFrame');
const mSegment     = document.getElementById('mSegment');
const mFetching    = document.getElementById('mFetching');
const mBufLevel    = document.getElementById('mBufLevel');
const mBufBar      = document.getElementById('mBufBar');
const mThroughput  = document.getElementById('mThroughput');
const mLastDl      = document.getElementById('mLastDl');
const sparklineEl  = document.getElementById('sparkline');
const repListEl    = document.getElementById('repList');
const abrLogEl     = document.getElementById('abrLog');
const abrEnabledCb = document.getElementById('abrEnabled');
const manualQualSel= document.getElementById('manualQuality');
const canvasBadge  = document.getElementById('canvasBadge');
const canvasBadgeText = document.getElementById('canvasBadgeText');
const rotateBtn      = document.getElementById('rotateBtn');
const bgColorPicker  = document.getElementById('bgColorPicker');
const resetViewBtn   = document.getElementById('resetViewBtn');
const fullscreenBtn  = document.getElementById('fullscreenBtn');
const pointSizeSlider= document.getElementById('pointSizeSlider');
const canvasPanel    = document.querySelector('.canvas-panel');

// NAVIS-style controls
const viewModeBtn    = document.getElementById('viewModeToggle');
const resetViewTopBtn= document.getElementById('resetViewTopBtn');
const fullscreenTopBtn = document.getElementById('fullscreenTopBtn');
const advancedToggle = document.getElementById('advancedToggle');
const advancedClose  = document.getElementById('advancedClose');
const advancedPanel  = document.getElementById('advancedPanel');
const back10Btn      = document.getElementById('back10Btn');
const prevFrameBtn   = document.getElementById('prevFrameBtn');
const nextFrameBtn   = document.getElementById('nextFrameBtn');
const fwd10Btn       = document.getElementById('fwd10Btn');
const speedPill      = document.getElementById('speedPill');
const speedSel       = document.getElementById('speedSel');
const loopToggle     = document.getElementById('loopToggle');
const colorModeSel   = document.getElementById('colorModeSel');
const pointSizeAdv   = document.getElementById('pointSizeAdv');
const pointSizeBadge = document.getElementById('pointSizeBadge');
const floorToggle    = document.getElementById('floorToggle');
const autoRotateToggle = document.getElementById('autoRotateToggle');
const bgThemeSel     = document.getElementById('bgThemeSel');
const uiThemeSel     = document.getElementById('uiThemeSel');
const flyBaseSpeedAdv = document.getElementById('flyBaseSpeedAdv');
const flyBaseSpeedBadge = document.getElementById('flyBaseSpeedBadge');
const flyBoostAdv    = document.getElementById('flyBoostAdv');
const flyBoostBadge  = document.getElementById('flyBoostBadge');
const flySlowAdv     = document.getElementById('flySlowAdv');
const flySlowBadge   = document.getElementById('flySlowBadge');
const lookSensAdv    = document.getElementById('lookSensAdv');
const lookSensBadge  = document.getElementById('lookSensBadge');
const loaderModal    = document.getElementById('loaderModal');
const loaderBar      = document.getElementById('loaderBar');
const loaderText     = document.getElementById('loaderText');
const mPlaybackFps   = document.getElementById('mPlaybackFps');
const mAvgBitrate    = document.getElementById('mAvgBitrate');
const mTotalStall    = document.getElementById('mTotalStall');
const mDecodeRate    = document.getElementById('mDecodeRate');
const mWorkers       = document.getElementById('mWorkers');
const mRuntime       = document.getElementById('mRuntime');
const mDownloaded    = document.getElementById('mDownloaded');
const mFramesPlayed  = document.getElementById('mFramesPlayed');
const mPeakThroughput= document.getElementById('mPeakThroughput');
const bufferSparkline= document.getElementById('bufferSparkline');
const qualityTimeline= document.getElementById('qualityTimeline');
const timelineLegend = document.getElementById('timelineLegend');
const mDecodePerWorker = document.getElementById('mDecodePerWorker');
const mDecodeEffective = document.getElementById('mDecodeEffective');
const mDecodeDivisor   = document.getElementById('mDecodeDivisor');
const mDecodePoolFps   = document.getElementById('mDecodePoolFps');
const bitrateDist      = document.getElementById('bitrateDist');

// ── Constants ─────────────────────────────────────────────────────────────────
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Mobile is a demo view: cap segments so a phone loops a short teaser rather
// than streaming the full 600-segment sequence it can't sustainably decode.
const MOBILE_SEGMENT_CAP = 100;

// Worker-pool size. Override with ?workers=N for experiments.
// Auto-scales for the device — 16 × 64 MB WASM heap = ~1 GB baseline, which
// mobile tabs OOM-kill on load. Empirically, 2 is the largest pool that
// survives on phones; 4+ crashes even on modern flagships.
// Desktop: 16 · low-core desktop: 4 · mobile / low-memory: 2.
const MAX_WORKERS = (() => {
  const v = parseInt(new URLSearchParams(location.search).get('workers'), 10);
  if (Number.isFinite(v) && v > 0) return v;
  const cores = navigator.hardwareConcurrency || 4;
  const memGb = navigator.deviceMemory || 0;   // undefined on Safari
  if (IS_MOBILE) return 2;
  if (memGb && memGb <= 4) return 2;
  if (cores <= 4) return 4;
  return 16;
})();
// Pin the representation (?rep=N) for controlled worker-scaling tests — every
// worker count then decodes identical frames, so per-frame timings compare.
// -1 = not pinned (normal ABR).
const FORCED_REP = (() => {
  const v = new URLSearchParams(location.search).get('rep');
  return v == null ? -1 : parseInt(v, 10);
})();
// Playback tick rate.  The source is 30 fps and each .bin holds 10 frames,
// but the MPD declares one second per 10-frame segment, so the player runs at
// 10 fps — one third of the source rate.  Every QoE figure here (buffer
// seconds, stall, playback fps) is relative to THIS rate, not the source's.
// Small pools (mobile default, or ?workers=2) can't sustain 10 fps of decode,
// so playback drops to 5 fps to keep the decoder ahead of the play head.
// 3 fps was tried too but the visible choppiness wasn't worth the extra
// decode headroom — 5 fps is the sweet spot for phones.
const TARGET_FPS       = MAX_WORKERS <= 2 ? 5 : 10;
// No pre-roll: start playback the instant the first frame can be rendered.
const INITIAL_BUFFER_FRAMES = 1;
const BUFFER_AHEAD_SEC = 3;
const EWMA_ALPHA_UP    = 0.30;    // smoothed rises (avoid over-eager upshift)
const EWMA_ALPHA_DOWN  = 0.80;    // near-instant reaction to throughput drops
// Cheap numeric readouts refresh every METRICS_INTERVAL ms.  The expensive
// panels (timeline, distribution, sparklines — each rebuilds innerHTML) run at
// HEAVY_METRICS_INTERVAL.  Both used to run at 100 Hz, on the same thread that
// uploads point clouds to the GPU.
const METRICS_INTERVAL = 50;
const HEAVY_METRICS_INTERVAL = 250;
const THROUGHPUT_HIST  = 24;
// Retained per-segment timeline entries.  A looping session would otherwise
// grow this without bound and re-render every bar.
const SEG_TIMELINE_MAX = 600;
// ── ABR tuning ────────────────────────────────────────────────────────────────
const ABR_SAFETY       = 0.90;    // pick the highest rep that fits under
                                  // throughputEwma × this margin
const LIVE_TPUT_MS     = 150;     // cadence of the in-flight throughput probe
const STUCK_FRAME_MS   = 600;     // give up on an undecodable frame after this
                                  // long and step the play head past it

// Tier colour names (index 0 = lowest rep)
const TIER_COLORS = ['#ef4444','#f97316','#eab308','#2dd4bf','#22c55e'];
const TIER_NAMES  = ['Low','Med-Low','Medium','Med-High','High'];

// ── Worker pool ───────────────────────────────────────────────────────────────
// Each worker accumulates WASM linear-memory growth over decodes (codec
// allocates large internal buffers; freeing them returns memory to the
// internal allocator but does NOT shrink the linear heap). After ~hundreds
// of decodes the heap pushes past the 2 GB WASM ceiling and the next
// allocation fails with "Array buffer allocation failed in expandFileStorage".
// Solution: recycle workers — terminate after a threshold, respawn fresh.
// Threshold is intentionally low.  Empirically the WASM linear-memory grows
// ~30 MB per decode (codec working memory + MEMFS file storage that the
// allocator never returns to the OS).  OOM was observed at ~51 decodes per
// worker — recycle well before that.
// Aggressive recycling: each worker peaks at ~30 MB heap growth per decode.
// With 16 workers, a threshold of 25 still pushes the tab-wide memory past
// Chrome's ~4 GB per-tab cap.  12 decodes per worker keeps peak per-worker
// memory ≈ 256 MB initial + 360 MB growth ≈ 620 MB, so 16 workers fit in
// ~10 GB.  We also stagger the INITIAL decodeCount across the pool so
// recycle events spread out instead of all firing at once.
const MAX_DECODES_PER_WORKER = 12;

// Cache-bust the worker URL so edits to worker.js are picked up on every
// page load without manual hard-reload.  (The cache-buster on app.js does
// not cover Worker() URLs, which Chrome caches independently.)
const WORKER_URL = `worker.js?v=${Date.now()}`;

function spawnWorker() {
  const entry = { worker: new Worker(WORKER_URL), busy: false, decodeCount: 0, warmed: false };
  entry.worker.addEventListener('message', ev => onWorkerMsg(entry, ev));
  entry.worker.addEventListener('error', err => console.warn('[worker error]', err));
  // Warm up immediately: fetch, compile and instantiate the WASM before any
  // real job arrives.  This covers recycled replacements too — without it a
  // fresh worker pays WASM instantiation on its first *live* decode, which at
  // MAX_DECODES_PER_WORKER=12 happens every 12 frames per worker.
  entry.worker.postMessage({ type: 'warmup' });
  return entry;
}

function recycleWorker(entry) {
  const idx = workerPool.indexOf(entry);
  if (idx < 0) return;
  console.log(`[pool] recycling worker #${idx} after ${entry.decodeCount} decodes`);
  if (entry.warmed) warmedWorkers = Math.max(0, warmedWorkers - 1);
  try { entry.worker.terminate(); } catch (_) {}
  workerPool[idx] = spawnWorker();
}

const workerPool = Array.from({length: MAX_WORKERS}, (_, i) => {
  const e = spawnWorker();
  e.decodeCount = Math.floor(i * MAX_DECODES_PER_WORKER / MAX_WORKERS);
  return e;
});

const frameJobQueue = [];
const jobMap = new Map();
let messageId = 0;

// ── MPD / stream state ────────────────────────────────────────────────────────
let mpdData         = null;
let mpdBaseUrl      = '';
let representations = [];
let currentFetchRepIdx = 0;    // quality of segment currently being fetched
let currentPlayRepIdx  = -1;   // quality of frame currently on screen (-1 = uninitialised)

let isStreaming  = false;
let isFetching   = false;
let fetchTimer   = null;
let nextSegNum   = 1;
let nextSegIdx   = 0;
let segments     = [];

// ── ABR state ─────────────────────────────────────────────────────────────────
let throughputEwma    = 0;
let throughputHistory = [];
let isAbrEnabled      = true;
let manualRepIdx      = 0;
let abrLog            = [];
let lastDlInfo        = null;
let currentDownload   = null;  // {startMs, received} for the in-flight fetch —
                               // lets the estimator react mid-download
let framesSkipped     = 0;     // play head stepped over undecodable frames
let decodeErrors      = 0;     // decode jobs that produced no frame at all
let decodeWarnings    = 0;     // frames delivered despite a non-zero decoder status

// ── Stream stats ──────────────────────────────────────────────────────────────
let bitrateSumBps     = 0;     // sum of selected segment bandwidths (each segment = 1s)
let bitrateSegCount   = 0;     // number of segments fetched (denominator for avg)
let totalStallMs      = 0;     // accumulated stall time across the session
let stallStart        = 0;     // timestamp when current stall began (0 = not stalled)
let decodeTimestamps  = [];    // performance.now() of each decoded frame (rolling)
let playbackTimestamps = [];   // performance.now() of each rendered playback frame

// ── Session-summary state ─────────────────────────────────────────────────────
let sessionStart      = 0;     // performance.now() of Load click
let totalDownloaded   = 0;     // bytes accumulated across all segment fetches
let peakThroughput    = 0;     // highest sample of throughputEwma observed
const SEG_TIMELINE    = [];    // {repIdx, repId, segNum, tier} per fetched segment
const BUFFER_HIST     = [];    // rolling buffer-level samples (matches THROUGHPUT_HIST)

// ── Startup-latency measurements (one-shot per Load) ──────────────────────────
let tLoadClicked      = 0;     // when user clicked Load
let tFirstSegReq      = 0;     // when first segment fetch started
let tFirstFrameReady  = 0;     // when first decoded frame became available
let tPlaybackStarted  = 0;     // when startPlayback() ran
let tFirstRender      = 0;     // when the first frame was actually rendered
let perFrameDecodeMs  = [];    // wall-clock decode time per frame (postMessage → frame received)
// ── Pipeline-stage instrumentation ────────────────────────────────────────────
let tlvSplitMs        = [];    // parseTlvFrames() main-thread time, per segment
let wasmDecodeMs      = [];    // WASM _gpcc_decode_to_ply time, per frame (worker)
let plyParseMs        = [];    // PLY parse time, per frame (worker)
let gpuUploadMs       = [];    // setPointCloud upload time, per frame (main thread)
let framesRendered    = 0;     // frames actually drawn — achieved-fps numerator
let pendingJobStart   = new Map(); // msgId → t0; populated in dispatchJobs

// ── Playback state ────────────────────────────────────────────────────────────
let isPlaying        = false;
let currentPlayFrame = 0;
let playTimer        = null;
let userPaused       = false;   // sticky flag — prevents tryAutoPlay from auto-resuming

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = createRenderer(canvas);
setInterval(updateMetrics, METRICS_INTERVAL);

// Expose live ABR state for external probes (experiments / DevTools).
// Module-scoped vars are not on `window`; this getter snapshot is.
const _avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
// Steady-state average over the most recent samples — excludes the startup
// ramp (low reps decode fast, so a cumulative mean understates per-frame cost).
const _avgTail = (a, n) => _avg(a.slice(-n));
window.__nimbus = {
  snapshot() {
    const playMs = tPlaybackStarted > 0 ? performance.now() - tPlaybackStarted : 0;
    return {
      throughputBps:   throughputEwma,
      selectedRepId:   representations[currentFetchRepIdx]?.id || null,
      selectedBps:     representations[currentFetchRepIdx]?.bandwidth || 0,
      playingRepId:    currentPlayRepIdx >= 0 ? representations[currentPlayRepIdx]?.id : null,
      playingBps:      currentPlayRepIdx >= 0 ? representations[currentPlayRepIdx]?.bandwidth || 0 : 0,
      avgBitrateBps:   bitrateSegCount > 0 ? bitrateSumBps / bitrateSegCount : 0,
      downloadedBytes: totalDownloaded,
      // avgBitrateBps is the nominal ladder average; this is what actually
      // came over the wire.  Report the measured one in results.
      deliveredBitrateBps: (bitrateSegCount > 0 && mpdData)
        ? (totalDownloaded * 8) / (bitrateSegCount * mpdData.segDurSec) : 0,
      framesSkipped:   framesSkipped,
      decodeErrors:    decodeErrors,
      decodeWarnings:  decodeWarnings,
      stallS:          (totalStallMs + (stallStart !== 0 ? performance.now() - stallStart : 0)) / 1000,
      bufferS:         getBufferLevel(),
      isPlaying,
      isStreaming,
      // ── pipeline-stage timings (steady-state averages, ms) ──
      workers:         MAX_WORKERS,
      warmedWorkers:   warmedWorkers,
      tlvSplitMs:      _avgTail(tlvSplitMs, 100),
      wasmDecodeMs:    _avgTail(wasmDecodeMs, 100),
      plyParseMs:      _avgTail(plyParseMs, 100),
      gpuUploadMs:     _avgTail(gpuUploadMs, 100),
      perFrameDecodeMs:_avgTail(perFrameDecodeMs, 100),
      bufferFillMs:    (tFirstFrameReady > 0 && tFirstSegReq > 0) ? tFirstFrameReady - tFirstSegReq : 0,
      startupMs:       tPlaybackStarted > 0 ? tPlaybackStarted - tLoadClicked : 0,
      firstRenderMs:   tFirstRender > 0 ? tFirstRender - tLoadClicked : 0,
      framesRendered:  framesRendered,
      playFrame:       currentPlayFrame,
      achievedFps:     playMs > 0 ? framesRendered / (playMs / 1000) : 0,
      decodeFps:       decodeTimestamps.filter(t => t >= performance.now() - 1000).length,
    };
  }
};

// ── Decode throughput logger (once per second) ────────────────────────────────
setInterval(() => {
  if (!isStreaming) return;
  const cutoff = performance.now() - 1000;
  const fpsLast = decodeTimestamps.filter(t => t >= cutoff).length;
  const busy = workerPool.filter(w => w.busy).length;

  // Per-frame decode mean over the last 32 completed jobs (steady-state estimate)
  const tail = perFrameDecodeMs.slice(-32);
  const meanMs = tail.length ? tail.reduce((a,b) => a+b, 0) / tail.length : 0;
  const sPerFrame = meanMs / 1000;

  console.log(
    `[decode] ${fpsLast} fps · ${busy}/${MAX_WORKERS} workers · queue=${frameJobQueue.length}` +
    ` · per-frame ${meanMs.toFixed(1)} ms (${sPerFrame.toFixed(3)} s/frame, last ${tail.length} jobs)`
  );
}, 1000);

// ── Event wiring ──────────────────────────────────────────────────────────────
loadBtn.addEventListener('click', startLoad);
stopBtn.addEventListener('click', stopAll);
mpdUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') startLoad(); });
playBtn.addEventListener('click', () => { if (isPlaying) pausePlayback(); else resumePlayback(); });

rotateBtn.addEventListener('click', () => {
  const on = renderer.toggleAutoRotate();
  rotateBtn.textContent = on ? '⏹' : '⟳';
  rotateBtn.classList.toggle('rotate-active', on);
});

bgColorPicker.addEventListener('input', () => renderer.setBgColor(bgColorPicker.value));

// ── NAVIS-style canvas tools ─────────────────────────────────────────────────
resetViewBtn.addEventListener('click', () => renderer.resetView());

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    canvasPanel.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
});

function updatePointSizeFill() {
  const min = parseFloat(pointSizeSlider.min);
  const max = parseFloat(pointSizeSlider.max);
  const val = parseFloat(pointSizeSlider.value);
  const pct = ((val - min) / (max - min)) * 100;
  pointSizeSlider.style.setProperty('--pct', pct + '%');
}
pointSizeSlider.addEventListener('input', () => {
  renderer.setPointSize(parseFloat(pointSizeSlider.value));
  updatePointSizeFill();
});
updatePointSizeFill();

// ── NAVIS-style top-bar / advanced controls ─────────────────────────────────
viewModeBtn.addEventListener('click', () => {
  const mode = renderer.toggleViewMode();
  viewModeBtn.textContent = `Mode: ${mode === 'orbit' ? 'Orbit' : 'Fly (WASD)'}`;
  viewModeBtn.classList.toggle('active', mode === 'fly');
});
resetViewTopBtn.addEventListener('click', () => renderer.resetView());
fullscreenTopBtn.addEventListener('click', () => fullscreenBtn.click());

function setAdvancedOpen(on) {
  advancedPanel.classList.toggle('show', !!on);
  advancedToggle.classList.toggle('active', !!on);
  advancedToggle.textContent = on ? '✨ Hide advanced' : '✨ Advanced';
}
advancedToggle.addEventListener('click', () => setAdvancedOpen(!advancedPanel.classList.contains('show')));
advancedClose.addEventListener('click', () => setAdvancedOpen(false));

// Frame stepping
function stepFrame(delta) {
  if (!mpdData) return;
  // Cap at last known frame index (pruning makes getDecodedFrameCount
  // unreliable; getTotalKnownFrames is the true upper bound).
  const total = getTotalKnownFrames();
  currentPlayFrame = Math.max(0, Math.min(total - 1, currentPlayFrame + delta));
  if (!isPlaying) {
    const fi = getFrame(currentPlayFrame);
    if (fi?.buf) {
      try {
        // Frames arrive pre-parsed from the worker; parsePly is only for
        // legacy raw-PLY buffers.  Without this check the object was handed
        // to parsePly, which threw into a silent catch — stepping did nothing.
        const cloud = fi.buf.positions ? fi.buf : parsePly(fi.buf);
        renderer.setPointCloud(cloud);
        if (fi.repIdx !== undefined) { currentPlayRepIdx = fi.repIdx; updateQualityCard(currentPlayRepIdx); }
      } catch (e) { console.warn('[step] could not render frame', e); }
    }
  }
}
back10Btn.addEventListener('click', () => stepFrame(-10));
prevFrameBtn.addEventListener('click', () => stepFrame(-1));
nextFrameBtn.addEventListener('click', () => stepFrame(+1));
fwd10Btn.addEventListener('click',   () => stepFrame(+10));

// Speed (playback rate multiplier)
let playbackSpeed = 1;
function applySpeed(v) {
  playbackSpeed = parseFloat(v) || 1;
  speedPill.textContent = `${playbackSpeed}×`;
  // Re-create play interval at new rate
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = setInterval(advanceFrame, 1000 / (TARGET_FPS * playbackSpeed));
  }
}
speedSel.addEventListener('change', () => applySpeed(speedSel.value));

// Loop toggle (already exists conceptually; expose user control)
let loopAtEnd = true;
loopToggle.addEventListener('change', () => { loopAtEnd = loopToggle.checked; });

// ABR ceiling — cap the highest rep ABR can pick (helps keep decode load
// under the pool's per-second budget for smooth 30 fps playback).
const abrMaxSel = document.getElementById('abrMaxSel');
if (abrMaxSel) {
  abrMaxSel.addEventListener('change', () => {
    abrMaxRepIdx = parseInt(abrMaxSel.value, 10);
  });
}

// Color mode
colorModeSel.addEventListener('change', () => renderer.setColorMode(colorModeSel.value));

// Point size — sync the two sliders (transport + advanced)
function syncPointSize(v) {
  renderer.setPointSize(v);
  pointSizeSlider.value = v;
  pointSizeAdv.value = v;
  pointSizeBadge.textContent = parseFloat(v).toFixed(4);
  const min = parseFloat(pointSizeSlider.min), max = parseFloat(pointSizeSlider.max);
  pointSizeSlider.style.setProperty('--pct', (((v - min) / (max - min)) * 100) + '%');
}
pointSizeAdv.addEventListener('input', () => syncPointSize(pointSizeAdv.value));

// Floor plane
floorToggle.addEventListener('change', () => renderer.setFloorVisible(floorToggle.checked));

// Auto-rotate (also bound to existing rotateBtn)
autoRotateToggle.addEventListener('change', () => {
  // Force renderer to match checkbox state
  if (autoRotateToggle.checked !== rotateBtn.classList.contains('rotate-active')) {
    rotateBtn.click();
  }
});

// Themes
function setBgTheme(t) { document.body.dataset.bg = t; }
function setUiTheme(t) { document.body.dataset.ui = t; }
bgThemeSel.addEventListener('change', () => setBgTheme(bgThemeSel.value));
uiThemeSel.addEventListener('change', () => setUiTheme(uiThemeSel.value));

// Nav sensitivity sliders
function syncNav() {
  flyBaseSpeedBadge.textContent = parseFloat(flyBaseSpeedAdv.value).toFixed(1);
  flyBoostBadge.textContent    = parseFloat(flyBoostAdv.value).toFixed(1) + '×';
  flySlowBadge.textContent     = parseFloat(flySlowAdv.value).toFixed(2) + '×';
  lookSensBadge.textContent    = parseFloat(lookSensAdv.value).toFixed(1);
  renderer.setNavSensitivity({
    baseSpeed: parseFloat(flyBaseSpeedAdv.value),
    boost:     parseFloat(flyBoostAdv.value),
    slow:      parseFloat(flySlowAdv.value),
    look:      parseFloat(lookSensAdv.value) / 1000,
  });
}
[flyBaseSpeedAdv, flyBoostAdv, flySlowAdv, lookSensAdv].forEach(el => el.addEventListener('input', syncNav));
syncNav();

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  const tag = (e.target?.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  // Don't hijack WASD/QE when in Fly mode — renderer handles them
  const inFly = renderer.getViewMode() === 'fly';
  const k = e.key.toLowerCase();
  if (inFly && 'wasdqezc'.includes(k)) return;
  if (inFly && (e.key === 'Shift' || e.key === 'Control')) return;

  switch (e.key) {
    case ' ': case 'Space':
      e.preventDefault();
      if (!playBtn.disabled) { isPlaying ? pausePlayback() : resumePlayback(); }
      break;
    case 'r': case 'R':
      if (!rotateBtn.disabled) rotateBtn.click();
      break;
    case 'v': case 'V':
      viewModeBtn.click();
      break;
    case 'l': case 'L':
      loopToggle.checked = !loopToggle.checked;
      loopAtEnd = loopToggle.checked;
      break;
    case '0':
      renderer.resetView();
      break;
    case 'f': case 'F':
      fullscreenBtn.click();
      break;
    case '+': case '=': renderer.zoomBy(0.85); break;
    case '-': case '_': renderer.zoomBy(1.18); break;
    case 'ArrowLeft':
      e.preventDefault();
      stepFrame(e.shiftKey ? -10 : -1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      stepFrame(e.shiftKey ? 10 : 1);
      break;
    case 'Escape':
      if (advancedPanel.classList.contains('show')) setAdvancedOpen(false);
      else if (document.fullscreenElement) document.exitFullscreen();
      break;
  }
});

abrEnabledCb.addEventListener('change', () => {
  isAbrEnabled = abrEnabledCb.checked;
  manualQualSel.disabled = isAbrEnabled;
});
manualQualSel.addEventListener('change', () => {
  manualRepIdx = parseInt(manualQualSel.value, 10);
});

// ── Load & parse MPD ──────────────────────────────────────────────────────────
async function startLoad() {
  const url = mpdUrlInput.value.trim();
  if (!url) return;
  stopAll();
  tLoadClicked     = performance.now();
  tFirstSegReq     = 0;
  tFirstFrameReady = 0;
  tPlaybackStarted = 0;
  tFirstRender     = 0;
  perFrameDecodeMs = [];
  pendingJobStart.clear();
  setOverlay('Loading MPD…');
  loadBtn.disabled = true;
  stopBtn.disabled = false;

  try {
    mpdData = await fetchAndParseMpd(url);
    mpdBaseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    representations = mpdData.representations;

    manualQualSel.innerHTML = representations
      .map((r, i) => `<option value="${i}">${r.id} — ${formatBps(r.bandwidth)}</option>`)
      .join('');
    manualRepIdx = 0;

    buildRepList();
    totalTime.textContent = formatTime(mpdData.totalSec);

    isStreaming        = true;
    isFetching         = false;
    userPaused         = false;
    nextSegNum         = mpdData.segTemplate.startNumber;
    nextSegIdx         = 0;
    segments           = [];
    currentPlayFrame   = 0;
    currentFetchRepIdx = 0;
    currentPlayRepIdx  = -1;
    throughputEwma     = 0;
    throughputHistory  = [];
    lastDlInfo         = null;
    currentDownload    = null;
    framesSkipped      = 0;
    decodeErrors       = 0;
    decodeWarnings     = 0;
    abrLog             = [];
    abrLogEl.innerHTML = '';
    bitrateSumBps      = 0;
    bitrateSegCount    = 0;
    totalStallMs       = 0;
    stallStart         = 0;
    decodeTimestamps   = [];
    playbackTimestamps = [];
    sessionStart       = performance.now();
    totalDownloaded    = 0;
    peakThroughput     = 0;
    tlvSplitMs         = [];
    wasmDecodeMs       = [];
    plyParseMs         = [];
    gpuUploadMs        = [];
    perFrameDecodeMs   = [];
    framesRendered     = 0;
    SEG_TIMELINE.length = 0;
    BUFFER_HIST.length  = 0;
    if (renderDecodeLatency._win) renderDecodeLatency._win.length = 0;

    playBtn.disabled = false;
    rotateBtn.disabled = false;
    back10Btn.disabled = prevFrameBtn.disabled = nextFrameBtn.disabled = fwd10Btn.disabled = false;
    updateQualityCard(0);   // show lowest quality immediately while buffering
    setOverlay('Buffering…');
    scheduleFetch(0);
  } catch (e) {
    // Same story as a missing segment: point at the content rather than
    // leaving a bare HTTP status on screen.
    setOverlay(/40[34]/.test(e.message)
      ? `No manifest at ${url} — download the content and unpack it into data/ (see README).`
      : `Failed: ${e.message}`);
    stopBtn.disabled = true;
  }
  loadBtn.disabled = false;
}

async function fetchAndParseMpd(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  const doc  = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('MPD XML parse error');

  const mpd      = doc.querySelector('MPD');
  const totalSec = parseDuration(mpd.getAttribute('mediaPresentationDuration') || 'PT0S');
  const st       = doc.querySelector('SegmentTemplate');
  if (!st) throw new Error('No SegmentTemplate found');

  const timescale = parseInt(st.getAttribute('timescale') || '1', 10);
  const duration  = parseInt(st.getAttribute('duration')  || '1', 10);
  const startNum  = parseInt(st.getAttribute('startNumber') || '1', 10);
  const media     = st.getAttribute('media') || '';
  const segDurSec = duration / timescale;
  let totalSegments = Math.ceil(totalSec / segDurSec);
  if (IS_MOBILE) totalSegments = Math.min(totalSegments, MOBILE_SEGMENT_CAP);

  const reps = Array.from(doc.querySelectorAll('Representation'))
    .map(r => ({ id: r.getAttribute('id'), bandwidth: parseInt(r.getAttribute('bandwidth'), 10) }))
    .sort((a, b) => a.bandwidth - b.bandwidth);

  if (!reps.length) throw new Error('No representations found');
  return { representations: reps, segTemplate: {media, timescale, duration, startNumber: startNum},
           segDurSec, totalSegments, totalSec };
}

function parseDuration(s) {
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  return parseFloat(m[1]||0)*3600 + parseFloat(m[2]||0)*60 + parseFloat(m[3]||0);
}

function buildSegmentUrl(repId, segNum) {
  const path = mpdData.segTemplate.media
    .replace('$RepresentationID$', repId)
    .replace(/\$Number%(\d+)d\$/, (_, w) => String(segNum).padStart(parseInt(w,10),'0'))
    .replace('$Number$', String(segNum));
  return mpdBaseUrl + path;
}

// ── Fetch loop ────────────────────────────────────────────────────────────────
function scheduleFetch(delay) {
  if (fetchTimer) clearTimeout(fetchTimer);
  fetchTimer = setTimeout(doFetch, delay);
}

async function doFetch() {
  if (!isStreaming || isFetching) return;
  const lastSeg = mpdData.segTemplate.startNumber + mpdData.totalSegments - 1;
  if (nextSegNum > lastSeg) return;

  // Pace the fetch loop on how far *downloads* are ahead of the play head —
  // NOT on decoded frames. Decode is the slow stage; if the fetcher waits for
  // the decoded buffer to fill it never sees backpressure (the decoder can't
  // keep up) so it downloads the whole stream in one burst, after which the
  // "Downloaded" counter freezes. Pacing on fetched frames keeps the download
  // in lock-step with playback.
  if (getFetchAheadSec() >= BUFFER_AHEAD_SEC) { scheduleFetch(150); return; }

  isFetching = true;
  if (tFirstSegReq === 0) tFirstSegReq = performance.now();
  const repIdx = selectRepIdx();
  const rep    = representations[repIdx];
  const segNum = nextSegNum;
  const url    = buildSegmentUrl(rep.id, segNum);

  // Log every segment's ABR decision (not only quality switches) so the ABR
  // panel shows a running per-segment record rather than a single line.
  logAbrDecision(currentFetchRepIdx, repIdx, segNum);
  currentFetchRepIdx = repIdx;

  bitrateSumBps += rep.bandwidth;
  bitrateSegCount++;

  try {
    const t0   = performance.now();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    // Stream the body so the estimator can sample throughput *during* the
    // download (see pollLiveThroughput) instead of only when it completes —
    // a slow segment must not leave ABR blind for its whole duration.
    currentDownload = { startMs: t0, received: 0 };
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      currentDownload.received = received;
    }
    currentDownload = null;

    const u8 = new Uint8Array(received);
    let _off = 0;
    for (const c of chunks) { u8.set(c, _off); _off += c.length; }
    const buffer = u8.buffer;
    const dt     = performance.now() - t0;

    updateThroughput(buffer.byteLength, dt);
    lastDlInfo = {bytes: buffer.byteLength, ms: dt};
    totalDownloaded += buffer.byteLength;
    if (throughputEwma > peakThroughput) peakThroughput = throughputEwma;
    SEG_TIMELINE.push({
      repIdx, repId: rep.id, segNum,
      tier: Math.min(TIER_COLORS.length - 1,
        Math.round(repIdx / Math.max(1, representations.length - 1) * (TIER_COLORS.length - 1)))
    });
    if (SEG_TIMELINE.length > SEG_TIMELINE_MAX) SEG_TIMELINE.shift();

    const curSegIdx  = nextSegIdx++;
    nextSegNum++;
    const _tlv0      = performance.now();
    const frameBufs  = parseTlvFrames(buffer);
    tlvSplitMs.push(performance.now() - _tlv0);
    const frameCount = frameBufs.length > 0 ? frameBufs.length : 1;

    segments.push({
      segIdx: curSegIdx, repId: rep.id, repIdx, bandwidth: rep.bandwidth,
      segNum, frameCount,
      frames: new Array(frameCount).fill(null),
      pendingFrames: frameCount, decoded: false,
    });

    if (frameBufs.length === 0) enqueueDecodeJob(curSegIdx, 0, buffer);
    else frameBufs.forEach((fb, fi) => enqueueDecodeJob(curSegIdx, fi, fb));

    isFetching = false;
    scheduleFetch(10);
  } catch (e) {
    isFetching = false;
    currentDownload = null;
    if (/40[34]/.test(e.message)) {
      if (segments.length === 0) {
        // The very first segment is missing.  This is almost always a checkout
        // without the media payload: the repository ships the manifest, the
        // segments are downloaded separately.  Say so instead of buffering
        // against a URL that will never resolve.
        isStreaming = false;
        if (loaderModal) loaderModal.classList.remove('show');
        setOverlay(`No segment data found at ${rep.id}/ — download the content `
                 + `and unpack it next to stream.mpd (see README).`);
        return;
      }
      // A later 404 just means the stream is shorter than the manifest claims.
      mpdData.totalSegments = nextSegNum - mpdData.segTemplate.startNumber;
      return;
    }
    scheduleFetch(2000);
  }
}

// ── ABR ───────────────────────────────────────────────────────────────────────
// Asymmetric EWMA: rises are smoothed slowly (avoids over-eager upgrades when
// a small first segment downloads in microseconds and gives a misleading peak);
// drops are absorbed quickly (the player must react to a real network slowdown
// before the buffer drains).
function updateThroughput(bytes, ms) {
  const bps = (bytes * 8) / (ms / 1000);
  if (throughputEwma === 0) {
    throughputEwma = bps;
  } else {
    const alpha = bps < throughputEwma ? EWMA_ALPHA_DOWN : EWMA_ALPHA_UP;
    throughputEwma = alpha * bps + (1 - alpha) * throughputEwma;
  }
  throughputHistory.push(throughputEwma);
  if (throughputHistory.length > THROUGHPUT_HIST) throughputHistory.shift();
}

// In-flight throughput probe. updateThroughput() only fires when a segment
// finishes — for a slow segment that can be many seconds, during which the
// estimate (and ABR) are frozen and the buffer drains unchecked. Sampling the
// live transfer rate of the segment currently downloading lets the estimate
// drop within ~150 ms of a real network slowdown.
function pollLiveThroughput() {
  const dl = currentDownload;
  if (!dl || dl.received <= 0) return;
  const elapsed = (performance.now() - dl.startMs) / 1000;
  if (elapsed < 0.3) return;                       // ignore startup noise
  const liveBps = (dl.received * 8) / elapsed;
  if (liveBps < throughputEwma) throughputEwma = liveBps;   // only ever down
}
setInterval(pollLiveThroughput, LIVE_TPUT_MS);

// Maximum representation index ABR is allowed to select.  Set this to
// e.g. 2 (= r03) to keep decode under 700 ms per frame on this content,
// giving 16-worker pool throughput ~22 fps and a healthy buffer at 30 fps
// playback target.  The default `Infinity` lets ABR pick any rep including
// r05 which on high-density content takes ~1.8 s per frame.
let abrMaxRepIdx = Infinity;

function selectRepIdx() {
  if (FORCED_REP >= 0) return Math.min(FORCED_REP, representations.length - 1);
  if (!isAbrEnabled) return Math.min(manualRepIdx, representations.length - 1);

  const cap = Math.min(representations.length - 1, abrMaxRepIdx);

  // Throughput rule: the HIGHEST rep whose bitrate fits under the estimate
  // (with a safety margin) — not the "closest", which can pick a rep above
  // the link and guarantee an underrun.
  let tputIdx = 0;
  if (throughputEwma > 0) {
    for (let i = 0; i <= cap; i++) {
      if (representations[i].bandwidth <= throughputEwma * ABR_SAFETY) tputIdx = i;
    }
  }

  // Buffer rule: a draining buffer is the one signal that reacts instantly to
  // *any* bottleneck — slow network OR slow decode (which a throughput-only
  // estimate cannot see). Cap quality hard while the buffer is low so the
  // player sheds bitrate before it stalls instead of after.
  const buf = getBufferLevel();
  let bufIdx = cap;
  if      (buf < 0.6) bufIdx = 0;
  else if (buf < 1.2) bufIdx = Math.min(cap, 1);
  else if (buf < 2.0) bufIdx = Math.min(cap, 2);

  let idx = Math.min(tputIdx, bufIdx);

  // Ramp up one step at a time and only with a comfortable buffer — prevents
  // oscillation when the estimate hovers on a rep boundary. Downshifts are
  // never damped: the player must drop quality immediately.
  if (idx > currentFetchRepIdx) {
    idx = buf > 1.6 ? currentFetchRepIdx + 1 : currentFetchRepIdx;
  }
  return Math.max(0, Math.min(idx, cap));
}

function logAbrDecision(prevIdx, newIdx, segNum) {
  const prev = representations[prevIdx]?.id || '?';
  const next = representations[newIdx]?.id || '?';
  const dir  = newIdx > prevIdx ? 'up' : newIdx < prevIdx ? 'down' : 'same';
  abrLog.unshift({prev, next, segNum, dir, thr: throughputEwma});
  if (abrLog.length > 30) abrLog.pop();
  renderAbrLog();
}

function renderAbrLog() {
  abrLogEl.innerHTML = abrLog.map(e => {
    const thr   = e.thr > 0 ? formatBps(e.thr) : '?';
    const arrow = e.dir === 'up' ? '↑' : e.dir === 'down' ? '↓' : '→';
    const label = e.dir === 'same' ? e.next : `${e.prev}→${e.next}`;
    return `<div class="abr-entry ${e.dir}">${arrow} Seg ${e.segNum}: ${label} · ${thr}</div>`;
  }).join('');
}

// ── Worker dispatch ───────────────────────────────────────────────────────────
// Sort key added to jobs already behind the play head, so they queue after
// every frame the player can still show.
const PAST_JOB_PENALTY = 1e9;

function enqueueDecodeJob(segIdx, frameIdx, payload) {
  frameJobQueue.push({segIdx, frameIdx, payload});
  dispatchJobs();
}

function dispatchJobs() {
  // Sort the pending queue so segments closer to the play head are decoded
  // first.  Earlier segments fill the playback buffer; later segments are
  // only "ahead-buffering".  This keeps perceived latency low even if the
  // decode pool can't quite keep up with fetch throughput.
  if (frameJobQueue.length > 1) {
    // Compute the global frame index of the head of each segment so we can
    // pick the next segment based on play-head distance.
    let cum = 0;
    const segStart = new Map();
    for (const seg of segments) { segStart.set(seg.segIdx, cum); cum += seg.frameCount; }
    // Forward distance only.  A frame BEHIND the play head will never be
    // displayed, so it must not outrank one the player is about to need —
    // |distance| let a frame 5 behind beat a frame 10 ahead.
    const prio = (j) => {
      const d = (segStart.get(j.segIdx) ?? 0) + j.frameIdx - currentPlayFrame;
      return d >= 0 ? d : PAST_JOB_PENALTY - d;
    };
    frameJobQueue.sort((a, b) => prio(a) - prio(b));
  }
  while (frameJobQueue.length) {
    const wEntry = workerPool.find(w => !w.busy);
    if (!wEntry) return;
    const job   = frameJobQueue.shift();
    const msgId = `j${messageId++}`;
    // Hold the segment OBJECT, not just its index: after a loop restart the
    // index space is reused, and a late frame from the previous pass would
    // otherwise be written into a freshly fetched segment.
    jobMap.set(msgId, {segIdx: job.segIdx, frameIdx: job.frameIdx,
                       seg: segments[job.segIdx], wEntry});
    wEntry.busy = true;
    pendingJobStart.set(msgId, performance.now());
    wEntry.worker.postMessage({
      type: 'decode', id: msgId,
      index: job.segIdx, frameIndex: job.frameIdx,
      payload: job.payload, outputBinary: true,
    }, [job.payload]);
  }
}

let warmedWorkers = 0;   // workers that have finished WASM warm-up

function onWorkerMsg(wEntry, evt) {
  const msg = evt.data;
  if (!msg) return;

  if (msg.type === 'warmed') { wEntry.warmed = true; warmedWorkers++; return; }

  if (msg.type === 'error') {
    // Previously silent: a failed decode showed up only as a stall.  Falls
    // through to the bookkeeping below, which frees the worker.
    decodeErrors++;
    const job = jobMap.get(msg.id);
    console.warn(`[decode error] seg ${msg.index} frame ${job ? job.frameIdx : '?'}: ${msg.message}`);
  }

  if (msg.type === 'frame') {
    const jobInfo = jobMap.get(msg.id);
    if (!jobInfo) return;              // stale frame from a previous stream pass
    const seg = jobInfo.seg;
    if (seg && msg.frameIndex < seg.frames.length) {
      // Worker now parses PLY inside the worker and posts the typed arrays
      // directly (msg.positions, msg.colors, msg.count).  We store the
      // pre-parsed cloud object so advanceFrame can skip parsing entirely.
      if (msg.positions) {
        seg.frames[msg.frameIndex] = {
          positions: msg.positions,
          colors:    msg.colors,
          count:     msg.count,
          hasColor:  msg.hasColor,
        };
      } else if (msg.frame) {
        // Legacy / fallback: store raw PLY bytes; advanceFrame will parse.
        seg.frames[msg.frameIndex] = msg.frame;
      }
    }
    const now = performance.now();
    decodeTimestamps.push(now);
    if (tFirstFrameReady === 0) tFirstFrameReady = now;
    const t0 = pendingJobStart.get(msg.id);
    if (t0 !== undefined) perFrameDecodeMs.push(now - t0);
    tryAutoPlay();
    return;
  }

  const info = jobMap.get(msg.id);
  if (info) {
    jobMap.delete(msg.id);
    info.wEntry.busy = false;
    info.wEntry.decodeCount++;
    // Frames delivered, but the decoder's packed-output tail reported a
    // failure (see the note in worker.js).  Harmless, but counted so a real
    // regression here cannot hide.
    if (msg.decoderStatus) {
      decodeWarnings++;
      if (decodeWarnings === 1) {
        console.warn('[decode] frames streamed but decoder returned '
          + `${msg.decoderStatus} (${msg.decoderMessage || 'no message'}) — `
          + 'frame kept; see the packed-output note in worker.js');
      }
    }
    if (msg.decodeTotalMs !== undefined) {
      // decodeTotalMs spans _gpcc_decode_to_ply, which synchronously includes
      // the in-worker PLY parse — subtract it for the pure WASM decode cost.
      wasmDecodeMs.push(Math.max(0, msg.decodeTotalMs - (msg.parseMs || 0)));
      plyParseMs.push(msg.parseMs || 0);
    }
    const seg = info.seg;
    if (seg) {
      seg.pendingFrames = Math.max(0, seg.pendingFrames - 1);
      if (seg.pendingFrames === 0) seg.decoded = true;
      if (msg.type === 'done' && msg.frames) {
        const now = performance.now();
        const t0 = pendingJobStart.get(msg.id);
        msg.frames.forEach((f, fi) => {
          if (fi < seg.frames.length) seg.frames[fi] = f;
          decodeTimestamps.push(now);
          if (tFirstFrameReady === 0) tFirstFrameReady = now;
          if (t0 !== undefined) perFrameDecodeMs.push(now - t0);
        });
        seg.decoded = true;
      }
    }
    // Recycle worker after enough decodes — prevents WASM heap exhaustion
    // (which manifested as RangeError in expandFileStorage around ~500
    //  decodes per worker = ~8000 frames total across the pool).
    if (info.wEntry.decodeCount >= MAX_DECODES_PER_WORKER) {
      recycleWorker(info.wEntry);
    }
  } else {
    wEntry.busy = false;
  }
  pendingJobStart.delete(msg.id);
  dispatchJobs();
  tryAutoPlay();
}

// ── Playback ──────────────────────────────────────────────────────────────────
function getFrame(globalIdx) {
  let count = 0;
  for (const seg of segments) {
    if (globalIdx < count + seg.frameCount)
      return {buf: seg.frames[globalIdx - count], repId: seg.repId, repIdx: seg.repIdx, segNum: seg.segNum};
    count += seg.frameCount;
  }
  return null;
}

function getTotalKnownFrames()  { return segments.reduce((s, g) => s + g.frameCount, 0); }

// Free decoded-frame ArrayBuffers that are well behind the play head.
// Keeps the main-thread memory bounded: without this, segments[] retains
// every frame ever played, accumulating ~100–500 kB per frame.
const PRUNE_KEEP_BEHIND = 60;       // frames retained before play head (~6 s)
function pruneOldFrames() {
  const cutoff = currentPlayFrame - PRUNE_KEEP_BEHIND;
  if (cutoff <= 0) return;
  let cumIdx = 0;
  for (const seg of segments) {
    const segEnd = cumIdx + seg.frameCount;
    if (segEnd <= cutoff) {
      // Whole segment is past cutoff; release every frame buffer.
      for (let i = 0; i < seg.frames.length; i++) seg.frames[i] = null;
    } else if (cumIdx < cutoff) {
      // Partially past; release only the frames before cutoff.
      for (let i = 0; i < seg.frameCount; i++) {
        if (cumIdx + i < cutoff) seg.frames[i] = null;
      }
    } else break;   // remaining segments are all ahead of the cutoff
    cumIdx = segEnd;
  }
}
function getDecodedFrameCount() { return segments.reduce((s, g) => s + g.frames.filter(Boolean).length, 0); }

// Count frames decoded AT OR AFTER the current play head.
// `getDecodedFrameCount() - currentPlayFrame` is no longer a valid proxy:
// `pruneOldFrames()` nulls frames behind the play head, so the subtraction
// drops by exactly the number pruned and the buffer reads zero even when
// plenty of frames are still buffered ahead.  We must walk forward and
// count non-null frames directly.
function getDecodedFramesAhead() {
  let count = 0;
  let cumIdx = 0;
  for (const seg of segments) {
    const segEnd = cumIdx + seg.frameCount;
    if (segEnd > currentPlayFrame) {
      const startInSeg = Math.max(0, currentPlayFrame - cumIdx);
      for (let i = startInSeg; i < seg.frames.length; i++) {
        if (seg.frames[i]) count++;
      }
    }
    cumIdx = segEnd;
  }
  return count;
}

function getBufferLevel() { return getDecodedFramesAhead() / TARGET_FPS; }

// Seconds of *fetched* content ahead of the play head. Unlike getBufferLevel
// (decoded frames) this counts every frame in a downloaded segment whether or
// not it has been decoded yet — it is what the fetch loop throttles on.
function getFetchAheadSec() {
  return Math.max(0, getTotalKnownFrames() - currentPlayFrame) / TARGET_FPS;
}

function tryAutoPlay() {
  if (userPaused) return;   // user explicitly paused — do not silently resume
  // Initial buffering: wait until we have at least INITIAL_BUFFER_FRAMES
  // decoded so playback has a runway and the buffer isn't empty on tick 1.
  const decoded = getDecodedFrameCount();
  if (!isPlaying && decoded < INITIAL_BUFFER_FRAMES) {
    if (loaderModal) {
      loaderModal.classList.add('show');
      if (loaderBar)  loaderBar.style.width = Math.min(100, (decoded / INITIAL_BUFFER_FRAMES) * 100) + '%';
      if (loaderText) loaderText.textContent = `Buffering ${decoded} / ${INITIAL_BUFFER_FRAMES}`;
    }
    return;
  }
  if (loaderModal) loaderModal.classList.remove('show');
  if (!isPlaying && isStreaming && getDecodedFrameCount() > 0) startPlayback();
}

function startPlayback() {
  if (isPlaying) return;
  isPlaying = true;
  playBtn.textContent = '⏸';
  overlay.classList.add('hidden');
  canvasBadge.style.display = '';
  startPlayback._epoch = performance.now();  // wall-clock origin for frame-skip
  playTimer = setInterval(advanceFrame, 1000 / (TARGET_FPS * (typeof playbackSpeed === 'number' ? playbackSpeed : 1)));

  if (tPlaybackStarted === 0) {
    tPlaybackStarted = performance.now();
    const bufferFillMs   = tFirstFrameReady - tFirstSegReq;
    const startupMs      = tPlaybackStarted - tLoadClicked;
    const meanDecodeMs   = perFrameDecodeMs.length
      ? perFrameDecodeMs.reduce((a,b) => a+b, 0) / perFrameDecodeMs.length : 0;
    console.log('═══ Startup latency report ═══');
    console.log(`  Buffer fill (first seg req → first frame ready): ${bufferFillMs.toFixed(0)} ms`);
    console.log(`  Startup latency (Load clicked → playback begin): ${startupMs.toFixed(0)} ms`);
    console.log(`  Per-frame decode (mean over ${perFrameDecodeMs.length} frame${perFrameDecodeMs.length===1?'':'s'} so far): ${meanDecodeMs.toFixed(1)} ms (${(meanDecodeMs/1000).toFixed(3)} s/frame)`);
  }
}

function pausePlayback() {
  if (!isPlaying) return;
  isPlaying  = false;
  userPaused = true;
  playBtn.textContent = '▶';
  clearInterval(playTimer);
  playTimer = null;
}

function resumePlayback() {
  if (!isStreaming) return;
  userPaused = false;
  if (getDecodedFrameCount() > 0) startPlayback();
}

function advanceFrame() {
  const fi = getFrame(currentPlayFrame);

  if (!fi || !fi.buf) {
    if (stallStart === 0) stallStart = performance.now();
    statusDot.className  = 'dot buffering';
    statusText.textContent = 'Buffering…';
    // Never deadlock on an undecodable frame. The fetch loop paces on the
    // play head, so a play head wedged on a frame that never decodes freezes
    // downloads, the throughput estimate and ABR all at once. After
    // STUCK_FRAME_MS, step over the frame — a brief skip beats an endless
    // stall, and it frees the fetcher so ABR can shed quality and recover.
    if (performance.now() - stallStart > STUCK_FRAME_MS &&
        currentPlayFrame + 1 < getTotalKnownFrames()) {
      currentPlayFrame++;
      framesSkipped++;
    }
    return;
  }

  if (stallStart !== 0) {
    totalStallMs += performance.now() - stallStart;
    stallStart = 0;
  }

  try {
    // fi.buf is either a pre-parsed cloud object (positions/colors/count)
    // straight from the worker, or — fallback — raw PLY bytes that we
    // parse on demand. Workers parse-in-place since 2026-05-14 so the
    // parsePly call below is only taken on legacy buffers.
    const cloud = (fi.buf.positions) ? fi.buf : parsePly(fi.buf);
    const _up0 = performance.now();
    renderer.setPointCloud(cloud);
    gpuUploadMs.push(performance.now() - _up0);
    framesRendered++;
    if (tFirstRender === 0) tFirstRender = performance.now();
  } catch (_) { /* skip corrupted frame */ }

  playbackTimestamps.push(performance.now());

  if (fi.repIdx !== undefined && fi.repIdx !== currentPlayRepIdx) {
    currentPlayRepIdx = fi.repIdx;
    updateQualityCard(currentPlayRepIdx);   // rebuilds DOM — only on a real switch
  }

  // ── Frame-skip when behind wall clock ──────────────────────────────────
  // Advance at most 1 frame per tick — this preserves visual continuity
  // and prevents the play head from chasing the decode head until the
  // buffer is zero.  When the decoder produces frames faster than the
  // tick consumes them, the buffer grows; when slower, playback drifts
  // and reads `pbFps < target` in the UI.  This is better than skipping,
  // which both drains the buffer instantly and yields jumpy visuals.
  //
  // Note: the wall-clock drift never exceeds (target_fps − decode_fps) Hz
  // and resets each time the loop wraps (`currentPlayFrame = 0`).
  currentPlayFrame++;

  pruneOldFrames();

  const allFetched = !isStreaming || nextSegNum > mpdData.segTemplate.startNumber + mpdData.totalSegments - 1;
  if (currentPlayFrame >= getTotalKnownFrames() && allFetched) {
    if (loopAtEnd) restartStream();
    else           endPlayback();
  }
}

// Replay the stream from the first segment.
//
// Rewinding the play head alone is not enough, which is why the `loopAtEnd`
// toggle used to do nothing at all: pruneOldFrames() has long since released
// every frame more than PRUNE_KEEP_BEHIND behind the head, and the fetch loop
// has already run past the last segment, so the rewound head lands on nulls
// that nothing re-fetches — playback then crawls forward one skipped frame
// per tick for the rest of the stream.  Dropping the decoded state and
// re-arming the fetcher replays it properly.  In-flight decodes from the
// previous pass are harmless: their jobs hold a reference to the old segment
// object (see dispatchJobs), so their frames land there and are collected.
function restartStream() {
  segments.length      = 0;
  frameJobQueue.length = 0;
  currentPlayFrame     = 0;
  nextSegNum           = mpdData.segTemplate.startNumber;
  nextSegIdx           = 0;
  isFetching           = false;
  isStreaming          = true;
  startPlayback._epoch = performance.now();
  scheduleFetch(0);
}

// Stop at the end of the stream (loop disabled).  Uses the same sticky-pause
// path as the user pressing pause, so tryAutoPlay does not silently resume.
function endPlayback() {
  pausePlayback();
  statusDot.className    = 'dot idle';
  statusText.textContent = 'Ended';
}

function stopAll() {
  isStreaming = false;
  isFetching  = false;
  userPaused  = false;
  pausePlayback();
  if (fetchTimer) { clearTimeout(fetchTimer); fetchTimer = null; }
  segments.length = 0;
  frameJobQueue.length = 0;
  jobMap.forEach(info => { info.wEntry.busy = false; });
  jobMap.clear();
  workerPool.forEach(w => { w.busy = false; });
  currentPlayFrame   = 0;
  nextSegNum         = 1;
  nextSegIdx         = 0;
  decodeErrors       = 0;
  decodeWarnings     = 0;
  currentFetchRepIdx = 0;
  currentPlayRepIdx  = -1;
  bitrateSumBps      = 0;
  bitrateSegCount    = 0;
  totalStallMs       = 0;
  stallStart         = 0;
  decodeTimestamps   = [];
  sessionStart       = 0;
  totalDownloaded    = 0;
  peakThroughput     = 0;
  SEG_TIMELINE.length = 0;
  BUFFER_HIST.length  = 0;
  if (renderDecodeLatency._win) renderDecodeLatency._win.length = 0;
  renderer.resetCamera();
  playBtn.disabled   = true;
  rotateBtn.disabled = true;
  rotateBtn.textContent = '⟳';
  rotateBtn.classList.remove('rotate-active');
  canvasBadge.style.display = 'none';
  setOverlay('Enter an MPD URL and press Load');
  resetMetrics();
}

// ── Quality card update (called immediately on rep change) ────────────────────
function updateQualityCard(repIdx) {
  if (!representations.length) return;
  const rep  = representations[repIdx];
  const n    = representations.length;
  // Map repIdx → tier index clamped to TIER_COLORS length
  const tier = Math.min(TIER_COLORS.length - 1, Math.round(repIdx / Math.max(1, n-1) * (TIER_COLORS.length-1)));
  const col  = TIER_COLORS[tier];
  const name = n <= TIER_COLORS.length ? TIER_NAMES[tier] : `Level ${repIdx+1}`;

  mQualityId.textContent   = rep.id;
  mQualityId.className     = `quality-id tier-${tier}`;
  mQualityTier.textContent = name;
  mQualityTier.className   = `quality-tier tier-${tier}-c`;
  mBandwidth.textContent   = formatBps(rep.bandwidth);

  // Canvas corner badge
  canvasBadgeText.textContent = rep.id;
  canvasBadge.style.color     = col;
  canvasBadge.style.borderColor = col + '55';

  // Level bars
  const maxBw = Math.max(...representations.map(r => r.bandwidth));
  qualityBars.innerHTML = representations.map((r, i) => {
    const h   = Math.max(12, r.bandwidth / maxBw * 32);
    const c   = TIER_COLORS[Math.min(TIER_COLORS.length-1, Math.round(i/(Math.max(1,n-1))*(TIER_COLORS.length-1)))];
    const act = i === repIdx ? 'active' : '';
    return `<div class="qbar ${act}" style="height:${h}px;background:${c}"></div>`;
  }).join('');
}

// ── Metrics (polled at METRICS_INTERVAL) ──────────────────────────────────────
function updateMetrics() {
  if (!mpdData) return;

  // One buffer scan per tick, shared by the buffer bar and the seek bar.
  // These walked every buffered frame separately, three times a tick.
  const framesAhead = getDecodedFramesAhead();
  const bufLevel    = framesAhead / TARGET_FPS;
  const totalSec    = mpdData.totalSec;
  const totalFrEst  = Math.round(totalSec * TARGET_FPS);
  const curSec      = currentPlayFrame / TARGET_FPS;

  // Status dot + text
  if (isStreaming && isPlaying) {
    statusDot.className    = 'dot playing';
    statusText.textContent = 'Playing';
  } else if (isStreaming) {
    statusDot.className    = 'dot buffering';
    statusText.textContent = 'Buffering';
  } else {
    statusDot.className    = 'dot idle';
    statusText.textContent = 'Idle';
  }

  // Frame / segment
  mFrame.textContent   = `${currentPlayFrame} / ~${totalFrEst}`;
  const fetched = nextSegNum - mpdData.segTemplate.startNumber;
  mSegment.textContent = `${fetched} / ${mpdData.totalSegments}`;
  mFetching.textContent = representations[currentFetchRepIdx]?.id || '—';

  // Network
  mThroughput.textContent = throughputEwma > 0 ? formatBps(throughputEwma) : '—';
  mLastDl.textContent = lastDlInfo
    ? `${formatBytes(lastDlInfo.bytes)} · ${lastDlInfo.ms.toFixed(0)} ms` : '—';

  // Buffer bar
  const bufPct = Math.min(100, (bufLevel / BUFFER_AHEAD_SEC) * 100);
  mBufLevel.textContent = bufLevel.toFixed(1) + ' s';
  mBufBar.style.width = bufPct + '%';
  if (bufLevel < 0.5)       mBufBar.style.background = 'linear-gradient(90deg,#7f1d1d,#ef4444)';
  else if (bufLevel < 1.2)  mBufBar.style.background = 'linear-gradient(90deg,#713f12,#eab308)';
  else                      mBufBar.style.background = 'linear-gradient(90deg,#14532d,#22c55e)';

  // Seek bar — "buffered" segment represents "decode head" (play head +
  // frames decoded ahead), not total non-null frames, so pruning doesn't
  // make the buffered indicator shrink artificially.
  if (totalFrEst > 0) {
    const decodeHead = currentPlayFrame + framesAhead;
    const playPct = Math.min(100, currentPlayFrame / totalFrEst * 100);
    const bufEnd  = Math.min(100, decodeHead     / totalFrEst * 100);
    seekPlayed.style.width = playPct + '%';
    seekBuf.style.width    = bufEnd  + '%';
    seekThumb.style.left   = playPct + '%';
  }

  timeDisplay.textContent = formatTime(curSec);

  // Stream stats
  const avgBps = bitrateSegCount > 0 ? bitrateSumBps / bitrateSegCount : 0;
  mAvgBitrate.textContent = avgBps > 0 ? formatBps(avgBps) : '—';

  let stallNow = totalStallMs;
  if (stallStart !== 0) stallNow += performance.now() - stallStart;
  mTotalStall.textContent = (stallNow / 1000).toFixed(1) + ' s';

  // Decode rate: count frames decoded in the last 1000 ms (sliding window)
  const cutoff = performance.now() - 1000;
  while (decodeTimestamps.length > 0 && decodeTimestamps[0] < cutoff) decodeTimestamps.shift();
  mDecodeRate.textContent = decodeTimestamps.length + ' fps';

  // Playback FPS — actual rendered-frame rate, computed from the same
  // 1-second sliding window. Distinct from "Decode Rate" (frames produced
  // by the worker pool) — this measures frames actually shown on screen.
  while (playbackTimestamps.length > 0 && playbackTimestamps[0] < cutoff) playbackTimestamps.shift();
  const pbFps = playbackTimestamps.length;
  const pbTarget = TARGET_FPS * (typeof playbackSpeed === 'number' ? playbackSpeed : 1);
  mPlaybackFps.textContent = isPlaying
    ? `${pbFps} fps  (target ${pbTarget})`
    : '— fps';

  // Worker utilisation
  const busyWorkers = workerPool.filter(w => w.busy).length;
  mWorkers.textContent = `${busyWorkers} / ${MAX_WORKERS}`;

  // Session summary
  const runtimeS = sessionStart > 0 ? (performance.now() - sessionStart) / 1000 : 0;
  mRuntime.textContent       = formatTime(runtimeS);
  mDownloaded.textContent    = formatBytes(totalDownloaded);
  mFramesPlayed.textContent  = String(currentPlayFrame);
  mPeakThroughput.textContent= peakThroughput > 0 ? formatBps(peakThroughput) : '— bps';

  // ── Heavy panels (throttled to HEAVY_METRICS_INTERVAL) ──────────────
  // Each of these rebuilds a block of innerHTML; the timeline alone emits one
  // <div> per fetched segment.  Running them at the metrics cadence stole
  // main-thread time from the very pipeline being measured.
  const nowMs = performance.now();
  if (nowMs - (updateMetrics._lastHeavy || 0) < HEAVY_METRICS_INTERVAL) return;
  updateMetrics._lastHeavy = nowMs;

  // Quality card — reflects the frame on screen.  advanceFrame also refreshes
  // it the instant the played representation actually changes.
  if (currentPlayRepIdx >= 0) updateQualityCard(currentPlayRepIdx);

  renderSparkline();                 // throughput history

  // Rep list highlights (playing quality, not fetching)
  document.querySelectorAll('.rep-row').forEach((row, i) => {
    row.classList.toggle('active', i === currentPlayRepIdx);
  });

  // Buffer history — sampled here, so THROUGHPUT_HIST samples now span
  // ~6 s of history instead of ~0.24 s.
  BUFFER_HIST.push(bufLevel);
  if (BUFFER_HIST.length > THROUGHPUT_HIST) BUFFER_HIST.shift();
  renderBufferSparkline();

  renderQualityTimeline();           // per-segment quality strip
  renderDecodeLatency();             // per-worker vs. effective decode latency
  renderBitrateDist();               // segments per representation
}

function renderDecodeLatency() {
  // Per-job (single worker): how long ONE worker takes to decode ONE frame.
  // This is the codec's intrinsic cost — does not depend on pool size.
  const jobTail = perFrameDecodeMs.slice(-64);
  const perWorkerMs = jobTail.length
    ? jobTail.reduce((a, b) => a + b, 0) / jobTail.length
    : 0;

  // Effective per-frame interval = per-job ÷ (workers running in parallel).
  // Equivalently: span / (N − 1) over a 3-second sliding window of frame
  // arrivals.  This is what playback actually sees.
  const now = performance.now();
  if (!renderDecodeLatency._win) renderDecodeLatency._win = [];
  const win = renderDecodeLatency._win;
  for (const t of decodeTimestamps) if (win.length === 0 || t > win[win.length - 1]) win.push(t);
  const winCutoff = now - 3000;
  while (win.length > 0 && win[0] < winCutoff) win.shift();

  let effectiveMs = 0;
  let poolFps = 0;
  if (win.length >= 2) {
    const span = win[win.length - 1] - win[0];
    if (span > 0) {
      effectiveMs = span / (win.length - 1);
      poolFps     = (win.length - 1) / (span / 1000);
    }
  }

  // The implied parallelism = (per-worker wall time) / (effective per-frame).
  // Equals the number of workers running concurrently when the pool is busy.
  // Shown explicitly so the relationship between the two latency numbers is
  // visible: per-worker ÷ N ≈ effective.
  const parallelism = (perWorkerMs > 0 && effectiveMs > 0)
    ? perWorkerMs / effectiveMs : 0;

  mDecodePerWorker.textContent = perWorkerMs > 0 ? `${perWorkerMs.toFixed(0)} ms` : '— ms';
  mDecodeDivisor.textContent   = parallelism > 0
    ? `÷ ${parallelism.toFixed(1)}` : '— ×';
  mDecodeEffective.textContent = effectiveMs > 0 ? `${effectiveMs.toFixed(0)} ms` : '— ms';
  mDecodePoolFps.textContent   = poolFps > 0 ? `${poolFps.toFixed(1)} fps` : '— fps';
}

function renderBitrateDist() {
  if (!representations.length) { bitrateDist.innerHTML = ''; return; }
  // Count segments per rep
  const counts = new Array(representations.length).fill(0);
  for (const s of SEG_TIMELINE) counts[s.repIdx] = (counts[s.repIdx] || 0) + 1;
  const total = SEG_TIMELINE.length || 1;
  const maxCount = Math.max(...counts, 1);
  const n = representations.length;
  bitrateDist.innerHTML = representations.map((r, i) => {
    const tier = Math.min(TIER_COLORS.length - 1,
      Math.round(i / Math.max(1, n - 1) * (TIER_COLORS.length - 1)));
    const col = TIER_COLORS[tier];
    const wPct = (counts[i] / maxCount) * 100;
    const pct  = (counts[i] / total)    * 100;
    return `<div class="dist-row">
              <span class="dist-id" style="color:${col}">${r.id}</span>
              <div class="dist-bar-outer">
                <div class="dist-bar-inner" style="width:${wPct.toFixed(1)}%;background:${col}"></div>
              </div>
              <span class="dist-count">${counts[i]} · ${pct.toFixed(0)}%</span>
            </div>`;
  }).join('');
}

function renderBufferSparkline() {
  const vals = BUFFER_HIST;
  if (!vals.length) { bufferSparkline.innerHTML = ''; return; }
  const maxV = Math.max(...vals, BUFFER_AHEAD_SEC);
  const n = Math.max(1, THROUGHPUT_HIST);
  const padded = Array(n - vals.length).fill(0).concat(vals);
  bufferSparkline.innerHTML = padded.map((v, i) => {
    const hPct  = Math.max(4, v / maxV * 100);
    const alpha = 0.25 + 0.75 * (i / (n - 1));
    const ratio = v / BUFFER_AHEAD_SEC;
    const col   = ratio > 0.66 ? '#22c55e' : ratio > 0.33 ? '#eab308' : '#ef4444';
    return `<div class="spark-bar" style="height:${hPct}%;background:${col};opacity:${alpha.toFixed(2)}"></div>`;
  }).join('');
}

function renderQualityTimeline() {
  if (!representations.length) { qualityTimeline.innerHTML = ''; timelineLegend.innerHTML = ''; return; }
  const total = SEG_TIMELINE.length;
  if (total === 0) { qualityTimeline.innerHTML = ''; return; }

  // Per-segment colour bars
  qualityTimeline.innerHTML = SEG_TIMELINE.map((s, i) => {
    const isNow = i === total - 1;
    return `<div class="timeline-bar${isNow ? ' now' : ''}"
                 style="background:${TIER_COLORS[s.tier]}"
                 title="Seg ${s.segNum}: ${s.repId}"></div>`;
  }).join('');

  // Legend (rep id + colour)
  const n = representations.length;
  timelineLegend.innerHTML = representations.map((r, i) => {
    const tier = Math.min(TIER_COLORS.length - 1,
      Math.round(i / Math.max(1, n - 1) * (TIER_COLORS.length - 1)));
    return `<span class="timeline-legend-item">
              <span class="timeline-legend-swatch" style="background:${TIER_COLORS[tier]}"></span>
              ${r.id} · ${formatBps(r.bandwidth)}
            </span>`;
  }).join('');
}

function renderSparkline() {
  const vals = throughputHistory;
  if (!vals.length) { sparklineEl.innerHTML = ''; return; }
  const maxV = Math.max(...vals, 1);
  const n = Math.max(1, THROUGHPUT_HIST);
  // pad with zeros if not full
  const padded = Array(n - vals.length).fill(0).concat(vals);
  sparklineEl.innerHTML = padded.map((v, i) => {
    const hPct = Math.max(4, v / maxV * 100);
    const alpha = 0.2 + 0.8 * (i / (n - 1));
    const tierPct = v / maxV;
    const col = tierPct > 0.66 ? '#22c55e' : tierPct > 0.33 ? '#eab308' : '#ef4444';
    return `<div class="spark-bar" style="height:${hPct}%;background:${col};opacity:${alpha.toFixed(2)}"></div>`;
  }).join('');
}

function buildRepList() {
  const maxBw = Math.max(...representations.map(r => r.bandwidth));
  repListEl.innerHTML = representations.map((r, i) => {
    const n   = representations.length;
    const tier = Math.min(TIER_COLORS.length-1, Math.round(i/(Math.max(1,n-1))*(TIER_COLORS.length-1)));
    const col  = TIER_COLORS[tier];
    const bwPct = (r.bandwidth / maxBw * 100).toFixed(1);
    return `<div class="rep-row${i === currentPlayRepIdx ? ' active' : ''}" data-idx="${i}">
      <span class="rep-id" style="color:${col}">${r.id}</span>
      <div class="rep-bw-col">
        <span class="rep-bw-label">${formatBps(r.bandwidth)}</span>
        <div class="rep-bw-bar">
          <div class="rep-bw-fill" style="width:${bwPct}%;background:${col}88"></div>
        </div>
      </div>
      <div class="rep-active-dot"></div>
    </div>`;
  }).join('');

  // click to force quality when ABR off
  repListEl.querySelectorAll('.rep-row').forEach((row, i) => {
    row.addEventListener('click', () => {
      if (!isAbrEnabled) { manualRepIdx = i; manualQualSel.value = String(i); }
    });
  });
}

function resetMetrics() {
  statusDot.className    = 'dot idle';
  statusText.textContent = 'Idle';
  mFrame.textContent  = '—';
  mSegment.textContent = '—';
  mFetching.textContent = '—';
  mQualityId.textContent = '—';
  mQualityId.className   = 'quality-id';
  mQualityTier.textContent = '';
  mBandwidth.textContent = '— bps';
  qualityBars.innerHTML  = '';
  mThroughput.textContent = '—';
  mLastDl.textContent     = '—';
  mAvgBitrate.textContent = '—';
  mTotalStall.textContent = '0.0 s';
  mDecodeRate.textContent = '— fps';
  mPlaybackFps.textContent = '— fps';
  mWorkers.textContent    = `0 / ${MAX_WORKERS}`;
  mRuntime.textContent       = '0:00';
  mDownloaded.textContent    = '0 B';
  mFramesPlayed.textContent  = '0';
  mPeakThroughput.textContent= '— bps';
  bufferSparkline.innerHTML  = '';
  qualityTimeline.innerHTML  = '';
  timelineLegend.innerHTML   = '';
  mDecodePerWorker.textContent = '— ms';
  mDecodeEffective.textContent = '— ms';
  mDecodeDivisor.textContent   = '— ×';
  mDecodePoolFps.textContent   = '— fps';
  bitrateDist.innerHTML        = '';
  mBufLevel.textContent   = '0.0 s';
  mBufBar.style.width     = '0%';
  seekPlayed.style.width  = '0%';
  seekBuf.style.width     = '0%';
  seekThumb.style.left    = '0%';
  timeDisplay.textContent = '0:00';
  sparklineEl.innerHTML   = '';
}

function setOverlay(msg) {
  overlayMsg.textContent = msg;
  overlay.classList.remove('hidden');
}

// ── TLV frame splitter ────────────────────────────────────────────────────────
// Types: SPS=0 GPS=1 GeomBrick=2 APS=3 AttrBrick=4 TileInventory=5 FBM=6 ConstAttr=7
function parseTlvFrames(buffer) {
  const data    = new Uint8Array(buffer);
  const headers = [];
  const frames  = [];
  let pending   = [];
  let current   = null;
  let offset    = 0;

  while (offset + 5 <= data.length) {
    const type   = data[offset];
    const length = ((data[offset+1]<<24)|(data[offset+2]<<16)|(data[offset+3]<<8)|data[offset+4]) >>> 0;
    const end    = offset + 5 + length;
    if (end > data.length) break;
    const unit = data.subarray(offset, end);
    offset = end;

    if (type === 0 || type === 1 || type === 3) { headers.push(unit); }
    else if (type === 6 || type === 5)           { pending.push(unit); }
    else if (type === 2) {
      if (current !== null) frames.push(current);
      current = pending.concat([unit]); pending = [];
    } else if (type === 4 || type === 7) {
      if (current !== null) current.push(unit);
    }
  }
  if (current !== null && current.length > 0) frames.push(current);

  const headerSize = headers.reduce((s, u) => s + u.length, 0);
  return frames.map(units => {
    const frameSize = units.reduce((s, u) => s + u.length, 0);
    const buf = new Uint8Array(headerSize + frameSize);
    let pos = 0;
    headers.forEach(u => { buf.set(u, pos); pos += u.length; });
    units.forEach(u => { buf.set(u, pos); pos += u.length; });
    return buf.buffer;
  });
}

// ── PLY parser ────────────────────────────────────────────────────────────────
function parsePly(buffer) {
  const data      = new Uint8Array(buffer);
  const headerEnd = findHeaderEnd(data);
  const lines     = new TextDecoder().decode(data.slice(0, headerEnd)).split(/\r?\n/);

  let format = 'ascii', vertexCount = 0, inVertex = false;
  const properties = [];
  const typeInfo = {
    char:[1,(dv,o)=>dv.getInt8(o)],    int8:[1,(dv,o)=>dv.getInt8(o)],
    uchar:[1,(dv,o)=>dv.getUint8(o)],  uint8:[1,(dv,o)=>dv.getUint8(o)],
    short:[2,(dv,o)=>dv.getInt16(o,true)],   int16:[2,(dv,o)=>dv.getInt16(o,true)],
    ushort:[2,(dv,o)=>dv.getUint16(o,true)], uint16:[2,(dv,o)=>dv.getUint16(o,true)],
    int:[4,(dv,o)=>dv.getInt32(o,true)],    int32:[4,(dv,o)=>dv.getInt32(o,true)],
    uint:[4,(dv,o)=>dv.getUint32(o,true)],  uint32:[4,(dv,o)=>dv.getUint32(o,true)],
    float:[4,(dv,o)=>dv.getFloat32(o,true)],float32:[4,(dv,o)=>dv.getFloat32(o,true)],
    double:[8,(dv,o)=>dv.getFloat64(o,true)],float64:[8,(dv,o)=>dv.getFloat64(o,true)],
  };

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
      let vi = 0, color = {r:255,g:255,b:255};
      for (const prop of properties) {
        if (prop.type==='list') { vi += 1 + parseInt(vals[vi],10); continue; }
        const v = parseFloat(vals[vi++]);
        if (prop.name==='x') positions[i*3]=v;   if (prop.name==='y') positions[i*3+1]=v;
        if (prop.name==='z') positions[i*3+2]=v;  if (prop.name==='red')   color.r=v;
        if (prop.name==='green') color.g=v;       if (prop.name==='blue')  color.b=v;
      }
      if (colors) { colors[i*3]=color.r; colors[i*3+1]=color.g; colors[i*3+2]=color.b; }
    }
  } else if (format.includes('binary_little_endian')) {
    const view = new DataView(buffer, headerEnd);
    let off = 0;
    for (let i = 0; i < vertexCount; i++) {
      let color = {r:255,g:255,b:255};
      for (const prop of properties) {
        if (prop.type==='list') {
          const ci=typeInfo[prop.countType], ii=typeInfo[prop.itemType];
          if (!ci||!ii) throw new Error(`Unsupported PLY list: ${prop.countType} ${prop.itemType}`);
          const cnt=ci[1](view,off); off+=ci[0]+cnt*ii[0]; continue;
        }
        const rd=typeInfo[prop.type];
        if (!rd) throw new Error(`Unsupported PLY type: ${prop.type}`);
        const v=rd[1](view,off); off+=rd[0];
        if (prop.name==='x') positions[i*3]=v;   if (prop.name==='y') positions[i*3+1]=v;
        if (prop.name==='z') positions[i*3+2]=v;  if (prop.name==='red')   color.r=v;
        if (prop.name==='green') color.g=v;       if (prop.name==='blue')  color.b=v;
      }
      if (colors) { colors[i*3]=color.r; colors[i*3+1]=color.g; colors[i*3+2]=color.b; }
    }
  } else {
    throw new Error(`Unsupported PLY format: ${format}`);
  }

  return {positions, colors, count: vertexCount, hasColor};
}

function findHeaderEnd(data) {
  for (const m of [new TextEncoder().encode('end_header\n'), new TextEncoder().encode('end_header\r\n')]) {
    outer: for (let i = 0; i <= data.length - m.length; i++) {
      for (let j = 0; j < m.length; j++) if (data[i+j] !== m[j]) continue outer;
      return i + m.length;
    }
  }
  throw new Error('PLY header end not found');
}

// ── WebGL2 renderer ───────────────────────────────────────────────────────────
// ── Three.js-based renderer (replaces the custom WebGL2 path) ────────────────
// Adopted from NAVIS-Player: BufferGeometry + PointsMaterial + OrbitControls
// with damping. Each frame's positions are normalised (centre+scale) using
// constants derived from the FIRST frame, so the cloud sits at the origin
// and is bounded by ±1 — matching the camera's default radius. This gives
// the smooth, three.js-quality orbit feel without any custom matrix code.
function createRenderer(canvas) {
  if (typeof THREE === 'undefined') {
    throw new Error('three.min.js failed to load (must be loaded before app.js)');
  }

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
  camera.position.set(0, 0, 3);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  // Background colour kept as a Three.Color so theme changes are cheap.
  let bgColor = new THREE.Color('#030610');
  scene.background = bgColor.clone();

  // OrbitControls — damping gives that buttery three.js feel.
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minDistance = 0.05;
  controls.maxDistance = 50;
  controls.target.set(0, 0, 0);
  controls.autoRotateSpeed = 1.5;
  controls.update();

  // ── Fly mode (NAVIS-style WASD + pointer-lock first-person nav) ─────────
  const ViewModes = { ORBIT: 'orbit', FLY: 'fly' };
  let viewMode = ViewModes.ORBIT;
  let pointerLocked = false;
  let yaw = 0, pitch = 0, roll = 0;
  const PITCH_LIMIT = Math.PI / 2 - 0.05;
  const flyMove = { fwd:false, bwd:false, left:false, right:false, up:false, down:false };
  const rollState = { left:false, right:false };
  const flyVel = new THREE.Vector3();
  let flyBaseSpeed = 3.2, flyBoostMult = 3.0, flySlowMult = 0.35;
  const flyAccel = 24, flyDamping = 10;
  let rollVel = 0;
  let shiftHeld = false, ctrlHeld = false;
  let lookSensitivity = 0.0022;
  const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  function resetFlyMotion() {
    flyVel.set(0, 0, 0);
    for (const k in flyMove) flyMove[k] = false;
    rollState.left = rollState.right = false;
    rollVel = 0; shiftHeld = ctrlHeld = false;
  }
  function setViewMode(mode) {
    if (mode === viewMode) return;
    viewMode = mode;
    if (mode === ViewModes.FLY) {
      controls.enabled = false;
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      yaw = Math.atan2(d.x, -d.z);
      pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
      roll = 0; resetFlyMotion();
      tmpEuler.set(pitch, yaw, roll, 'YXZ');
      camera.quaternion.setFromEuler(tmpEuler);
    } else {
      document.exitPointerLock?.();
      resetFlyMotion(); roll = 0;
      controls.enabled = true;
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      controls.update();
    }
  }
  canvas.addEventListener('click', () => {
    if (viewMode === ViewModes.FLY && !pointerLocked) canvas.requestPointerLock?.();
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', e => {
    if (viewMode !== ViewModes.FLY || !pointerLocked) return;
    const rv = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();
    const uv = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize();
    const qY = new THREE.Quaternion().setFromAxisAngle(uv, -e.movementX * lookSensitivity);
    const qP = new THREE.Quaternion().setFromAxisAngle(rv, -e.movementY * lookSensitivity);
    camera.quaternion.premultiply(qY).premultiply(qP);
    const eu = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = eu.y;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, eu.x));
    roll = eu.z;
    tmpEuler.set(pitch, yaw, roll, 'YXZ');
    camera.quaternion.setFromEuler(tmpEuler);
  });
  window.addEventListener('keydown', e => {
    if (viewMode !== ViewModes.FLY) return;
    const tg = (e.target?.tagName || '').toUpperCase();
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k==='w') flyMove.fwd = true;
    else if (k==='s') flyMove.bwd = true;
    else if (k==='a') flyMove.left = true;
    else if (k==='d') flyMove.right = true;
    else if (k==='z') flyMove.down = true;
    else if (k==='c') flyMove.up = true;
    else if (k==='q') rollState.left = true;
    else if (k==='e') rollState.right = true;
    else if (k==='shift') shiftHeld = true;
    else if (k==='control') ctrlHeld = true;
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k==='w') flyMove.fwd = false;
    else if (k==='s') flyMove.bwd = false;
    else if (k==='a') flyMove.left = false;
    else if (k==='d') flyMove.right = false;
    else if (k==='z') flyMove.down = false;
    else if (k==='c') flyMove.up = false;
    else if (k==='q') rollState.left = false;
    else if (k==='e') rollState.right = false;
    else if (k==='shift') shiftHeld = false;
    else if (k==='control') ctrlHeld = false;
  });

  // ── Floor plane (NAVIS-style ground reference) ──────────────────────────
  // FrontSide (top face only): a DoubleSide floor stays opaque from below, so
  // orbiting the camera beneath the model makes the dark slab sweep across and
  // occlude it — the "black straight line covering the cloud". A one-sided
  // ground reference simply vanishes when viewed from underneath.
  const floorGeo = new THREE.PlaneGeometry(12, 12);
  const floorMat = new THREE.MeshBasicMaterial({
    color: 0x1b222b, transparent: true, opacity: 0.55,
    side: THREE.FrontSide, depthWrite: false
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.05;
  floor.visible = false;
  scene.add(floor);

  // ── Colour mode (source / greyscale / mono) ──────────────────────────────
  let colorMode = 'source';
  // Keep the raw uint8 colours so we can re-derive on mode change.
  let rawColors = null;

  // One persistent geometry/material/mesh — we only swap attributes per frame.
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    size: 0.0035,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const pointcloud = new THREE.Points(geometry, material);
  scene.add(pointcloud);

  // Reused scratch buffers — avoid per-frame GC of multi-MB Float32Arrays.
  let posBuf = null;
  let colBuf = null;
  let bufN   = 0;
  let count  = 0;

  // First-frame normalisation constants. Reset by resetCamera().
  let normCenter = null;
  let normScale  = null;
  let hasCloud   = false;

  function resize() {
    const r = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w * r || canvas.height !== h * r) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  window.addEventListener('resize', resize);

  let lastT = performance.now();
  function animate() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    resize();
    if (viewMode === ViewModes.ORBIT) {
      controls.update();
    } else {
      // Apply WASD fly motion
      const speed = flyBaseSpeed * (shiftHeld ? flyBoostMult : (ctrlHeld ? flySlowMult : 1));
      const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
      const rgt = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const upv = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const dir = new THREE.Vector3();
      if (flyMove.fwd)  dir.add(fwd);
      if (flyMove.bwd)  dir.sub(fwd);
      if (flyMove.right)dir.add(rgt);
      if (flyMove.left) dir.sub(rgt);
      if (flyMove.up)   dir.add(upv);
      if (flyMove.down) dir.sub(upv);
      if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(flyAccel * dt);
        flyVel.add(dir);
      }
      const damp = 1 - Math.min(1, flyDamping * dt);
      flyVel.multiplyScalar(damp);
      if (flyVel.length() > speed) flyVel.setLength(speed);
      camera.position.addScaledVector(flyVel, dt);
      // Roll (Q/E)
      let rollIn = 0;
      if (rollState.left)  rollIn += 1;
      if (rollState.right) rollIn -= 1;
      rollVel += rollIn * 0.8 * dt * 8;
      rollVel *= (1 - Math.min(1, 8 * dt));
      if (Math.abs(rollVel) > 0.001) {
        roll += rollVel * dt;
        tmpEuler.set(pitch, yaw, roll, 'YXZ');
        camera.quaternion.setFromEuler(tmpEuler);
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  function ensureBuffers(n) {
    if (bufN >= n) return;
    bufN = n;
    posBuf = new Float32Array(n * 3);
    colBuf = new Uint8Array(n * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colBuf, 3, true));
  }

  function setPointCloud({ positions, colors, count: n }) {
    count = n;
    ensureBuffers(n);

    // Compute normalisation constants from the FIRST cloud only — subsequent
    // frames are warped by the same affine transform so the cloud never
    // "jumps" between frames (which would happen if each frame normalised
    // independently because per-frame bounds drift).
    if (!hasCloud) {
      let mnX=Infinity,mnY=Infinity,mnZ=Infinity;
      let mxX=-Infinity,mxY=-Infinity,mxZ=-Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], y = positions[i+1], z = positions[i+2];
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
        if (x < mnX) mnX = x; if (x > mxX) mxX = x;
        if (y < mnY) mnY = y; if (y > mxY) mxY = y;
        if (z < mnZ) mnZ = z; if (z > mxZ) mxZ = z;
      }
      if (!isFinite(mnX)) { mnX = mnY = mnZ = -1; mxX = mxY = mxZ = 1; }
      const cx = (mnX + mxX) / 2;
      const cy = (mnY + mxY) / 2;
      const cz = (mnZ + mxZ) / 2;
      const extent = Math.max(1e-6, Math.max(mxX-mnX, mxY-mnY, mxZ-mnZ));
      normCenter = { cx, cy, cz };
      normScale  = 2.0 / extent;
      hasCloud = true;
    }

    const cx = normCenter.cx, cy = normCenter.cy, cz = normCenter.cz, s = normScale;
    const pos = posBuf;
    for (let i = 0, j = 0; j < positions.length; i++, j += 3) {
      pos[j  ] = (positions[j  ] - cx) * s;
      pos[j+1] = (positions[j+1] - cy) * s;
      pos[j+2] = (positions[j+2] - cz) * s;
    }

    rawColors = colors || null;
    applyColorMode();

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate    = true;
    geometry.setDrawRange(0, n);
    geometry.computeBoundingSphere();
  }

  function applyColorMode() {
    const N = count;
    if (rawColors) {
      if (colorMode === 'source') {
        colBuf.set(rawColors);
      } else if (colorMode === 'greyscale') {
        for (let i = 0; i < N; i++) {
          const r = rawColors[i*3], g = rawColors[i*3+1], b = rawColors[i*3+2];
          // BT.709 luminance
          const y = (0.2126*r + 0.7152*g + 0.0722*b) | 0;
          colBuf[i*3] = colBuf[i*3+1] = colBuf[i*3+2] = y;
        }
      } else if (colorMode === 'mono') {
        colBuf.fill(255);
      }
    } else {
      colBuf.fill(colorMode === 'mono' ? 255 : 190);
    }
    if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
  }

  function setColorMode(mode) {
    if (mode === colorMode) return;
    colorMode = mode;
    if (count > 0) applyColorMode();
  }

  function setFloorVisible(v) { floor.visible = !!v; }

  function setNavSensitivity({ baseSpeed, boost, slow, look }) {
    if (baseSpeed != null) flyBaseSpeed = baseSpeed;
    if (boost     != null) flyBoostMult = boost;
    if (slow      != null) flySlowMult  = slow;
    if (look      != null) lookSensitivity = look;
  }

  function setBgColor(hex) {
    bgColor.set(hex);
    scene.background = bgColor.clone();
  }

  function toggleAutoRotate() {
    controls.autoRotate = !controls.autoRotate;
    return controls.autoRotate;
  }

  function resetCamera() {
    hasCloud   = false;
    normCenter = null;
    normScale  = null;
    camera.position.set(0, 0, 3);
    controls.target.set(0, 0, 0);
    controls.autoRotate = false;
    controls.update();
  }

  function zoomBy(f) {
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    dir.multiplyScalar(f);
    camera.position.copy(controls.target).add(dir);
    controls.update();
  }

  function setPointSize(s) {
    material.size = s;
  }

  function resetView() {
    camera.position.set(0, 0, 3);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function getViewMode() { return viewMode; }
  function toggleViewMode() {
    setViewMode(viewMode === ViewModes.ORBIT ? ViewModes.FLY : ViewModes.ORBIT);
    return viewMode;
  }

  return {
    setPointCloud, setBgColor, toggleAutoRotate, resetCamera, zoomBy, setPointSize, resetView,
    setColorMode, setFloorVisible, setNavSensitivity, toggleViewMode, getViewMode,
    ViewModes,
  };
}

function formatBps(bps) {
  if (bps>=1e9) return (bps/1e9).toFixed(2)+' Gbps';
  if (bps>=1e6) return (bps/1e6).toFixed(1)+' Mbps';
  if (bps>=1e3) return (bps/1e3).toFixed(0)+' kbps';
  return bps.toFixed(0)+' bps';
}

function formatBytes(b) {
  if (b>=1e6) return (b/1e6).toFixed(1)+' MB';
  if (b>=1e3) return (b/1e3).toFixed(0)+' KB';
  return b+' B';
}

function formatTime(sec) {
  const m=Math.floor(sec/60),s=Math.floor(sec%60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
