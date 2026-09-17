# NIMBUS-Player

NIMBUS is a browser-native player for dynamic adaptive streaming of G-PCC compressed point clouds. It pairs the first browser-native G-PCC decoder, compiled from the MPEG reference TMC13 codec to WebAssembly, with DASH-compliant segment delivery, parallel Web Worker decoding, and buffer-aware bitrate adaptation, enabling 6DoF volumetric playback directly in the browser with no plugins, native binaries, or server-side decoding.

Point a modern browser at an MPD, and NIMBUS fetches, decodes, and renders compressed point cloud video with orbit or fly navigation.

## Citation

If you use this work, please cite our paper:

```bibtex
@inproceedings{sidhu2026nimbus,
  title={NIMBUS: A Browser-Native Player for Dynamic Adaptive G-PCC Point Cloud Streaming},
  author={Sidhu, Jashan and Bentaleb, Abdelhak},
  booktitle={2026 IEEE International Workshop on Multimedia Signal Processing (MMSP)},
  year={2026},
  organization={IEEE}
}
```

## Get the code
```bash
git clone https://github.com/IN2GM-Lab/NIMBUS-Player.git
cd NIMBUS-Player
```

## Features
- **Browser-native G-PCC decoding:** The reference TMC13 decoder compiled to WebAssembly via Emscripten, covering octree, predictive, and trisoup geometry plus RAHT and lifting attribute decoding. No native dependencies, no server-side decode.
- **Group-of-Frames packaging:** A modified TMC13 encoder bundles N independently decodable frames into a single DASH-compliant segment by re-emitting parameter sets at each frame boundary, cutting per-frame HTTP request overhead.
- **Parallel decode pipeline:** A zero-copy TLV frame splitter feeds per-frame bitstreams to a pool of pre-warmed WASM workers, with playhead-proximity job ordering, mid-decode frame streaming, and automatic worker recycling to bound memory growth.
- **Adaptive playback:** Standard MPEG-DASH MPD parsing across multiple quality representations, an asymmetric EWMA throughput estimator with in-flight probing, and buffer-aware quality capping with damped upshifts.
- **Dual navigation modes:** Orbit for object-centric viewing; fly mode with pointer-lock, WASD movement, mouse-look, and Q/E roll for full 6DoF navigation.
- **Rendering controls:** Point size, size attenuation, per-vertex coloring, reusable buffer geometry, and first-frame normalization for temporal stability.
- **Live metrics sidebar:** Playback status, buffer level, throughput history, per-segment quality timeline, decode latency statistics, and bitrate distribution.

## Requirements
- Modern desktop browser with multi-core support (Chrome/Edge recommended)
- Simple HTTP server to host the page and serve the encoded segments
- Emscripten toolchain if rebuilding the WASM decoder from source

## Run locally

NIMBUS ships the player only — point cloud content is downloaded separately.

### 1. Get content

Pre-encoded, ready-to-stream sequences are available here:

**https://in2gm.encs.concordia.ca/s/NqK3PtqJw3n3Kcj**

Each sequence is a complete DASH stream: a `stream.mpd` manifest plus five
representations (`r01`–`r05`), 600 segments per representation, 10 frames per
segment. Unpack the download into a `data/` folder at the repository root:

```bash
mkdir -p data
# unpack the downloaded archive into data/
```

so that the tree looks like this:

```
NIMBUS-Player/
├── index.html, app.js, worker.js, …     the player
└── data/
    ├── octree-longdress/                stream.mpd + r01/ … r05/
    ├── octree-soldier/                  stream.mpd + r01/ … r05/
    └── octree-redandblack/              stream.mpd + r01/ … r05/
```

`data/` is listed in `.gitignore`, so downloaded content is never committed by
accident. To stream your own sequences instead, see
[Encoding your own content](#encoding-your-own-content).

### 2. Serve the folder

```bash
python3 serve.py 10000 .
```

`serve.py` is a static file server that adds permissive CORS headers, disables
caching, and serves `.wasm` with the correct MIME type. A plain
`python3 -m http.server` is not sufficient: it sends no
`Access-Control-Allow-Origin`, so the browser blocks the MPD and segment
fetches.

The player and the content do not have to share an origin. To serve them
separately — useful when the dataset lives on another machine — run a second
instance and paste that MPD URL into the player:

```bash
python3 serve.py 11000 /path/to/sequences     # data on another port or host
```

### 3. Play

Open **http://localhost:10000**, pick a sequence from the dropdown beside the
MPD field, and press **Load**. Playback starts as soon as the first frame
decodes; quality adapts automatically from there.

The MPD URL is built from the page's own origin, so the same address works from
another machine or a phone on the network (`http://<server-ip>:10000`). Any
other MPD URL can also be typed into the field directly.

| Control | Action |
|---------|--------|
| `Space` | play / pause |
| `V` | switch orbit ↔ fly navigation |
| `WASD` + mouse, `Q`/`E` | move / look / roll (fly mode) |
| `←` / `→` (`Shift` for ×10) | step frames |
| `0`, `F`, `R`, `L` | reset view, fullscreen, auto-rotate, loop |

### Options

Two URL parameters are useful for experiments:

| Parameter | Effect |
|-----------|--------|
| `?workers=N` | Decode pool size (default 16). |
| `?rep=N` | Pin the representation, 0-indexed (`?rep=3` = `r04`), bypassing ABR. |

For example `http://localhost:10000/?workers=8&rep=3` decodes a fixed quality
with an 8-worker pool — pinning the representation is what makes worker-count
sweeps comparable, since every pool size then decodes identical frames.

For automated runs, `window.__nimbus.snapshot()` returns the live player state
as a plain object — per-stage timings (`tlvSplitMs`, `wasmDecodeMs`,
`plyParseMs`, `gpuUploadMs`), `stallS`, `bufferS`, `framesRendered`,
`achievedFps`, `deliveredBitrateBps` and more — which can be polled over the
DevTools Protocol for headless measurement.

## Encoding your own content

NIMBUS streams **multi-frame G-PCC segments**: each segment carries N
consecutive frames, and every frame within it is independently decodable
because the parameter sets are re-emitted at each frame boundary. That is what
lets the worker pool decode the frames of one segment in parallel.

The modified TMC13 encoder that produces this packaging is available here:

**https://github.com/IN2GM-Lab/mpeg-pcc-tmc13**

Use it to encode your own point cloud sequences into the multi-frame G-PCC
format NIMBUS expects, at as many rate points as you want representations.

To publish an encoded sequence:

1. Put each rate point in its own folder (`r01`, `r02`, …), one `.bin` per
   segment, zero-padded and numbered from 1 (`0001.bin`, `0002.bin`, …).
2. Write a `stream.mpd` beside those folders. NIMBUS reads a standard
   `SegmentTemplate` — `media="$RepresentationID$/$Number%04d$.bin"` with
   `timescale`, `duration` and `startNumber` — plus one `<Representation>` per
   rate point carrying `id` and `bandwidth`. Representations are sorted by
   `bandwidth`, so the ladder order comes from the manifest and nothing is
   hardcoded in the player.
3. Drop the folder into `data/` and either select it from the dropdown (edit
   the three `<option>` values in `index.html`) or paste its MPD URL into the
   field.

Already have single- or multi-frame `.bin` segments? `tools/split_bins.py`
re-packs them into the smaller, independently decodable sub-segments used here:

```bash
python3 tools/split_bins.py --base-dir data/my-sequence --frames-per-segment 10
python3 tools/split_bins.py --base-dir data/my-sequence --move    # <rep>_split → <rep>
```

Rebuilding the decoder itself requires the Emscripten SDK and a TMC13 checkout;
`tools/build-wasm.sh` holds the build flags used for the shipped
`gpcc_decoder.wasm`.

## File structure

```
index.html          UI shell and sequence picker
app.js              streaming, ABR, decode scheduling, playback, metrics
worker.js           WASM decode + in-worker PLY parse (one instance per worker)
gpcc_decoder.js     Emscripten glue for the TMC13 decoder
gpcc_decoder.wasm   TMC13 decoder compiled to WebAssembly
styles.css          UI styling
serve.py            static file server with CORS headers and no-store caching
vendor/             three.js and OrbitControls (MIT — see vendor/README.md)
tools/              build-wasm.sh (decoder build), split_bins.py (re-packer)
data/               downloaded content — not part of the repository
```

The pipeline, end to end:

```
fetch(segment .bin)        streamed, so throughput is sampled mid-download
  → parseTlvFrames()       splits a multi-frame segment into self-contained
                           per-frame TLV payloads (each carries SPS/GPS/APS)
  → worker pool            one frame per worker, decoded in parallel
  → PLY parse in-worker    typed arrays transferred to the main thread, not copied
  → three.js               BufferGeometry upload, orbit / fly navigation
```

Quality selection (`selectRepIdx` in `app.js`) takes the minimum of a
throughput rule and a buffer-level rule. Decode, not network, is usually the
binding constraint for dense content, and a throughput-only estimator cannot
see that — a draining buffer is the one signal that reacts to either.

## Troubleshooting

**"No manifest at …" or "No segment data found at r01/"** — the player loaded
but the content did not. Check that the download was unpacked into `data/` with
the layout shown in [Run locally](#run-locally), and that the folder names
match the entries in the sequence dropdown.

**Nothing loads, console shows a CORS error** — the page is being served by
something that does not send `Access-Control-Allow-Origin` (for example
`python3 -m http.server`). Use `serve.py`.

**Playback stalls or runs below the target frame rate** — decoding is the
bottleneck, not the network. Raise the worker count (`?workers=24`), cap the
quality ladder with the ABR ceiling selector in the sidebar, or use a sequence
encoded at lower rate points. The sidebar's decode-latency panel shows
per-worker cost, the effective per-frame interval, and the resulting pool
throughput; if the effective interval exceeds the frame period, the buffer will
drain no matter how fast the link is.

**Console warning: "frames streamed but decoder returned -6"** — harmless. The
decoder streams each frame out before returning, then re-collects frames from
its virtual filesystem starting at frame 0; payloads that do not begin at frame
0 report "No output frames produced" even though every frame was delivered.
NIMBUS treats the streamed frames as authoritative and counts these separately
from real failures (`decodeWarnings` vs `decodeErrors`).

**Tab becomes slow or runs out of memory over a long session** — each worker's
WASM heap grows with every decode and never shrinks, so workers are recycled
after a fixed number of decodes. Lowering `?workers=N` reduces peak memory
proportionally.

**Blank canvas** — the browser needs WebGL2 and Web Workers; check that
hardware acceleration is enabled.

## License

NIMBUS is open-source software released under the Apache License 2.0.
See the `LICENSE` file for full details.

## Contributing

Contributions are welcome.
Feel free to open an issue or submit a pull request for bug fixes, improvements, or new features.

By contributing, you agree that your contributions will be licensed under Apache 2.0.
