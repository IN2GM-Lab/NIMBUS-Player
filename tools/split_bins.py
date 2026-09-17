#!/usr/bin/env python3
"""
Re-pack each per-segment G-PCC .bin into smaller per-segment .bin files
containing N frames each.

Default: 30 frames per source segment → 3 sub-segments of 10 frames each.
No frames are discarded; this is purely a re-segmentation (different
DASH chunk size, same total content, same stream frame rate).

Each output .bin is self-contained: SPS + GPS + APS (most recent of each)
+ any pending TileInventory/FBM + N × (GeomBrick + AttrBrick + ConstAttr).
"""
import argparse
from pathlib import Path

GLOBAL_TYPES  = {0, 1, 3}      # SPS, GPS, APS — most recent of each per sub-seg
PENDING_TYPES = {5, 6}          # TileInventory, FBM — queue until next GeomBrick
GEOM_TYPE     = 2
ATTR_TYPES    = {4, 7}          # AttrBrick, ConstAttr

# Directory holding the per-representation folders; override with --base-dir.
BASE_DIR = Path(__file__).resolve().parent
REPS     = ['r01', 'r02', 'r03', 'r04', 'r05']


def split_into_frames(buf):
    """Parse a multi-frame .bin into a list of per-frame dicts:
        { sps, gps, aps, pending, geom, attrs[] }
    where each dict holds the units active at the time of its GeomBrick.
    """
    last_sps = last_gps = last_aps = None
    pending  = []
    frames   = []
    current  = None
    off, n = 0, len(buf)
    while off + 5 <= n:
        t = buf[off]
        L = int.from_bytes(buf[off + 1:off + 5], 'big')
        end = off + 5 + L
        if end > n:
            break
        unit = buf[off:end]
        off = end
        if t == 0:   last_sps = unit
        elif t == 1: last_gps = unit
        elif t == 3: last_aps = unit
        elif t in PENDING_TYPES:
            pending.append(unit)
        elif t == GEOM_TYPE:
            if current is not None:
                frames.append(current)
            current = {
                'sps': last_sps, 'gps': last_gps, 'aps': last_aps,
                'pending': pending,
                'geom': unit,
                'attrs': [],
            }
            pending = []
        elif t in ATTR_TYPES:
            if current is not None:
                current['attrs'].append(unit)
    if current is not None:
        frames.append(current)
    return frames


def build_segment(frames):
    """Assemble a sub-segment .bin from a list of frame dicts.

    Layout: [SPS][GPS][APS] (most recent active at the first frame) then
    for each frame: [pending][geom][attrs...]  The frame-internal param
    sets are NOT repeated — the decoder retains them across frames in the
    same bitstream.
    """
    if not frames:
        return b''
    out = []
    if frames[0]['sps'] is not None: out.append(frames[0]['sps'])
    if frames[0]['gps'] is not None: out.append(frames[0]['gps'])
    if frames[0]['aps'] is not None: out.append(frames[0]['aps'])
    for f in frames:
        out.extend(f['pending'])
        out.append(f['geom'])
        out.extend(f['attrs'])
    return b''.join(out)


def do_split(frames_per_segment: int):
    total_in = 0
    total_out = 0
    for rep in REPS:
        src_dir = BASE_DIR / rep
        out_dir = BASE_DIR / (rep + '_split')
        if not src_dir.is_dir():
            print(f'[skip] {src_dir} not found')
            continue
        out_dir.mkdir(exist_ok=True)
        for old in out_dir.glob('*.bin'):
            old.unlink()

        out_idx = 1
        src_files = sorted(src_dir.glob('*.bin'))
        for src_file in src_files:
            buf = src_file.read_bytes()
            frames = split_into_frames(buf)
            total_in += len(frames)
            # Emit one sub-segment per chunk of `frames_per_segment`
            for start in range(0, len(frames), frames_per_segment):
                chunk = frames[start:start + frames_per_segment]
                (out_dir / f'{out_idx:04d}.bin').write_bytes(build_segment(chunk))
                out_idx += 1
                total_out += 1
        print(f'[ok]  {rep}: {len(src_files)} source segments × 30 frames '
              f'-> {out_idx - 1} sub-segments × {frames_per_segment} frames in {out_dir.name}/')
    print(f'\nTotal source frames: {total_in}, total sub-segments per rep: '
          f'{total_out // len(REPS)} ({frames_per_segment} frames each)')


def do_move():
    for rep in REPS:
        src   = BASE_DIR / rep
        split = BASE_DIR / (rep + '_split')
        orig  = BASE_DIR / (rep + '.orig')
        if not split.is_dir():
            print(f'[skip] {split} missing — nothing to move for {rep}')
            continue
        if orig.exists():
            print(f'[warn] {orig} already exists; will not overwrite — skipping {rep}')
            continue
        if src.is_dir():
            src.rename(orig)
        split.rename(src)
        print(f'[ok]  {rep}: split → live, original kept at {orig.name}/')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--frames-per-segment', type=int, default=10,
                   help='Frames in each output sub-segment (default 10 → 3 sub-segs from 30-frame source).')
    p.add_argument('--move', action='store_true',
                   help='Rename <rep>_split → <rep>; old <rep> → <rep>.orig.')
    p.add_argument('--base-dir', type=Path, default=BASE_DIR,
                   help='Directory containing the r01..r05 folders (default: this script\'s directory).')
    args = p.parse_args()
    global BASE_DIR
    BASE_DIR = args.base_dir.resolve()
    if args.move:
        do_move()
    else:
        do_split(args.frames_per_segment)


if __name__ == '__main__':
    main()
