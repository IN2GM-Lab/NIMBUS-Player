# NIMBUS-Player

NIMBUS is a browser-native player for dynamic adaptive streaming of G-PCC compressed point clouds. It pairs the first browser-native G-PCC decoder, compiled from the MPEG reference TMC13 codec to WebAssembly, with DASH-compliant segment delivery, parallel Web Worker decoding, and buffer-aware bitrate adaptation, enabling 6DoF volumetric playback directly in the browser with no plugins, native binaries, or server-side decoding.

Point a modern browser at an MPD, and NIMBUS fetches, decodes, and renders compressed point cloud video with orbit or fly navigation.

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
_Instructions coming soon._

## Encoding your own content
_Instructions coming soon._

## File structure
_Coming soon._

## Troubleshooting
_Coming soon._

## License

NIMBUS is open-source software released under the Apache License 2.0.
See the `LICENSE` file for full details.

## Contributing

Contributions are welcome.
Feel free to open an issue or submit a pull request for bug fixes, improvements, or new features.

By contributing, you agree that your contributions will be licensed under Apache 2.0.

## Citation

Paper coming soon.
