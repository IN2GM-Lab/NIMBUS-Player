# NIMBUS-Player

NIMBUS is a browser-native player for dynamic adaptive streaming of G-PCC compressed point clouds. It pairs the first browser-native G-PCC decoder, compiled from the MPEG reference TMC13 codec to WebAssembly, with DASH-compliant segment delivery, parallel Web Worker decoding, and buffer-aware bitrate adaptation, enabling 6DoF volumetric playback directly in the browser with no plugins, native binaries, or server-side decoding.

## Try it

**Site is hosted at:** `<PLACEHOLDER — add GitHub Pages URL here>`

Open the link in a modern desktop browser (Chrome/Edge recommended). Pick a sequence from the dropdown and press **Load** — playback starts as soon as the first frame decodes, quality adapts automatically from there. No downloads or setup: the demo content is served from a public Cloudflare R2 bucket with CORS enabled, so everything runs in your browser.

| Control | Action |
|---------|--------|
| `Space` | play / pause |
| `V` | switch orbit ↔ fly navigation |
| `WASD` + mouse, `Q`/`E` | move / look / roll (fly mode) |
| `←` / `→` (`Shift` for ×10) | step frames |
| `0`, `F`, `R`, `L` | reset view, fullscreen, auto-rotate, loop |

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

## Features
- **Browser-native G-PCC decoding:** The reference TMC13 decoder compiled to WebAssembly via Emscripten, covering octree, predictive, and trisoup geometry plus RAHT and lifting attribute decoding. No native dependencies, no server-side decode.
- **Group-of-Frames packaging:** A modified TMC13 encoder bundles N independently decodable frames into a single DASH-compliant segment by re-emitting parameter sets at each frame boundary, cutting per-frame HTTP request overhead.
- **Parallel decode pipeline:** A zero-copy TLV frame splitter feeds per-frame bitstreams to a pool of pre-warmed WASM workers, with playhead-proximity job ordering, mid-decode frame streaming, and automatic worker recycling to bound memory growth.
- **Adaptive playback:** Standard MPEG-DASH MPD parsing across multiple quality representations, an asymmetric EWMA throughput estimator with in-flight probing, and buffer-aware quality capping with damped upshifts.
- **Dual navigation modes:** Orbit for object-centric viewing; fly mode with pointer-lock, WASD movement, mouse-look, and Q/E roll for full 6DoF navigation.
- **Rendering controls:** Point size, size attenuation, per-vertex coloring, reusable buffer geometry, and first-frame normalization for temporal stability.
- **Live metrics sidebar:** Playback status, buffer level, throughput history, per-segment quality timeline, decode latency statistics, and bitrate distribution.

## Options

Two URL parameters are useful for experiments:

| Parameter | Effect |
|-----------|--------|
| `?workers=N` | Decode pool size (default 16). |
| `?rep=N` | Pin the representation, 0-indexed (`?rep=3` = `r04`), bypassing ABR. |

For automated runs, `window.__nimbus.snapshot()` returns the live player state
as a plain object — per-stage timings (`tlvSplitMs`, `wasmDecodeMs`,
`plyParseMs`, `gpuUploadMs`), `stallS`, `bufferS`, `framesRendered`,
`achievedFps`, `deliveredBitrateBps` and more — which can be polled over the
DevTools Protocol for headless measurement.

## Running your own copy

To host the player yourself or serve different content:

1. Clone this branch.
2. Point the MPD URLs in `app.js` (`DEFAULT_MPD_URL`) and `index.html` (the sequence dropdown) at your own CORS-enabled stream host.
3. Serve the folder as a static site — GitHub Pages, Cloudflare Pages, Netlify, or any static host with HTTPS works.

For encoding your own content into the multi-frame G-PCC format NIMBUS expects, see the [`main` branch](https://github.com/IN2GM-Lab/NIMBUS-Player) — it contains the local-development setup, the modified TMC13 encoder link, and content-packaging tools.

## File structure

```
index.html          UI shell and sequence picker
app.js              streaming, ABR, decode scheduling, playback, metrics
worker.js           WASM decode + in-worker PLY parse (one instance per worker)
gpcc_decoder.js     Emscripten glue for the TMC13 decoder
gpcc_decoder.wasm   TMC13 decoder compiled to WebAssembly
styles.css          UI styling
vendor/             three.js and OrbitControls (MIT — see vendor/README.md)
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

**Blank canvas** — the browser needs WebGL2 and Web Workers; check that
hardware acceleration is enabled.

**Playback stalls or runs below the target frame rate** — decoding is the
bottleneck, not the network. Cap the quality ladder with the ABR ceiling
selector in the sidebar, or lower `?workers=N` if peak memory is the concern.
The sidebar's decode-latency panel shows per-worker cost, the effective
per-frame interval, and the resulting pool throughput.

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

## License

NIMBUS is open-source software released under the Apache License 2.0.
See the `LICENSE` file for full details.

## Contributing

Contributions are welcome.
Feel free to open an issue or submit a pull request for bug fixes, improvements, or new features.

By contributing, you agree that your contributions will be licensed under Apache 2.0.
