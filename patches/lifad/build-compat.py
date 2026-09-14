#!/usr/bin/env python3
"""Build the Ruffle-compatibility patched SWF for 2009-lifad.

The original SWF (originals/2009-lifad.swf) builds the RAMMSTEIN wordmark with
nine clip-depth masks (PlaceObject2 clipDepth) inside DefineSprite 48:
letter-shaped sprites clip animated gold-gradient bars. Ruffle (0.6.0 and
nightly 2026-09-12) fails to constrain the bars, so the logo renders as solid
gold rectangles (ruffle-rs/ruffle issue #23630).

This script rewrites the masks to the equivalent ActionScript runtime path:

  content.setMask(mask); mask._visible = false;

The masking geometry, gradients, tweens and all other tags stay untouched. The
original file is never modified; the patched file is written separately.

Usage:
  python3 build-compat.py <original.swf> <patched.swf> [workdir]
Requires: FFDec 26.2.1 at /root/repos/rammwiki/benzin/tools/ffdec/ffdec.jar
          (override with FFDEC_JAR), plus java on PATH.
"""
import json
import os
import re
import subprocess
import sys
import hashlib

FFDEC_JAR = os.environ.get(
    'FFDEC_JAR', '/root/repos/rammwiki/benzin/tools/ffdec/ffdec.jar')

# mask sprite character id -> own timeline depth inside DefineSprite 48
MASK_IDS = {'30', '33', '35', '37', '39', '41', '43', '45', '47'}


def run(args):
    proc = subprocess.run(['java', '-jar', FFDEC_JAR] + args,
                          capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        raise SystemExit('ffdec failed: %s' % ' '.join(args))


def as_bytecode(calls):
    """Assemble AVM1 bytecode for `c.setMask(m); m._visible = false;` calls."""
    pool = []

    def idx(s):
        if s not in pool:
            pool.append(s)
        return pool.index(s)

    ops = bytearray()
    for content, mask in calls:
        ops += bytes([0x96, 0x02, 0x00, 0x08, idx(mask)]) + b'\x1c'
        ops += bytes([0x96, 0x05, 0x00, 0x07]) + (1).to_bytes(4, 'little')
        ops += bytes([0x96, 0x02, 0x00, 0x08, idx(content)]) + b'\x1c'
        ops += bytes([0x96, 0x02, 0x00, 0x08, idx('setMask')])
        ops += bytes([0x52, 0x17])
        ops += bytes([0x96, 0x02, 0x00, 0x08, idx(mask)]) + b'\x1c'
        ops += bytes([0x96, 0x02, 0x00, 0x08, idx('_visible')])
        ops += bytes([0x96, 0x02, 0x00, 0x05, 0x00])
        ops += bytes([0x4f])
    payload = len(pool).to_bytes(2, 'little')
    for s in pool:
        payload += s.encode('ascii') + b'\x00'
    return (bytes([0x88]) + len(payload).to_bytes(2, 'little') + payload + ops).hex()


def set_attr(line, aname, value):
    if aname + '=' in line:
        return re.sub(aname + r'="[^"]*"', aname + '="' + value + '"', line)
    return re.sub(r'(characterId="\d+")', '\\1 ' + aname + '="' + value + '"', line)


def find_block(lines, marker):
    start = next(i for i, l in enumerate(lines) if marker in l)
    base = len(lines[start]) - len(lines[start].lstrip())
    end = next(i for i in range(start + 1, len(lines))
               if lines[i].strip() == '</item>'
               and (len(lines[i]) - len(lines[i].lstrip())) == base)
    return start, end


def patch_xml(xml_path, out_path):
    lines = open(xml_path, encoding='utf-8').read().split('\n')
    start, end = find_block(lines, 'spriteId="48"')
    indent = ' ' * (len(lines[start]) - len(lines[start].lstrip()) + 2)
    out = list(lines)
    insert_at = []
    frame_no = 0
    pending = []
    i = start + 1
    while i < end:
        line = out[i]
        s = line.strip()
        if s.startswith('<item type="PlaceObject'):
            m = re.search(r'characterId="(\d+)"', line)
            d = re.search(r'depth="(\d+)"', line)
            if m and d:
                cid, depth = m.group(1), int(d.group(1))
                if 'clipDepth=' in line and cid in MASK_IDS:
                    line = re.sub(r'\s+clipDepth="\d+"', '', line)
                    line = line.replace('placeFlagHasClipDepth="true"',
                                        'placeFlagHasClipDepth="false"')
                    line = line.replace('placeFlagHasName="false"',
                                        'placeFlagHasName="true"')
                    line = set_attr(line, 'name', 'm%03d' % depth)
                    out[i] = line
                    pending.append(('mask', depth, 'm%03d' % depth))
                elif cid == '31':
                    # content bar belonging to a mask at depth-2
                    mask_depths = {p[1] for p in pending if p[0] == 'mask'}
                    if (depth - 2) in mask_depths:
                        line = line.replace('placeFlagHasName="false"',
                                            'placeFlagHasName="true"')
                        line = set_attr(line, 'name', 'c%03d' % depth)
                        out[i] = line
                        pending.append(('content', depth, 'c%03d' % depth))
        elif s.startswith('<item type="ShowFrameTag"'):
            frame_no += 1
            masks = {p[1]: p[2] for p in pending if p[0] == 'mask'}
            contents = {p[1]: p[2] for p in pending if p[0] == 'content'}
            calls = []
            for md in sorted(masks):
                if (md + 2) in contents:
                    calls.append((contents[md + 2], masks[md]))
            if calls:
                hexcode = as_bytecode(calls)
                insert_at.append((i, indent +
                                  '<item type="DoActionTag" actionBytes="' +
                                  hexcode + '" forceWriteAsLong="true"/>'))
                print('  sprite48 frame %d: %d mask pair(s)' %
                      (frame_no, len(calls)))
            pending = []
        i += 1

    for offset, (at, text) in enumerate(insert_at):
        out.insert(at + offset, text)

    open(out_path, 'w', encoding='utf-8').write('\n'.join(out))
    return len(insert_at), sum(1 for l in lines[start:end + 1]
                               if 'clipDepth=' in l and 'PlaceObject' in l)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    original, patched = sys.argv[1], sys.argv[2]
    workdir = sys.argv[3] if len(sys.argv) > 3 else '/tmp/opencode/lifad-patch'
    os.makedirs(workdir, exist_ok=True)

    xml = os.path.join(workdir, 'lifad.xml')
    patched_xml = os.path.join(workdir, 'lifad-setmask.xml')
    print('1/3 swf2xml %s' % original)
    run(['-swf2xml', original, xml])
    print('2/3 inject setMask')
    actions, masks = patch_xml(xml, patched_xml)
    print('3/3 xml2swf %s' % patched)
    run(['-xml2swf', patched_xml, patched])

    print(json.dumps({
        'original': {'path': original, 'sha256': sha256(original)},
        'patched': {'path': patched, 'sha256': sha256(patched)},
        'clip_depth_masks_replaced': masks,
        'doactions_added': actions,
    }, indent=2))


if __name__ == '__main__':
    main()
