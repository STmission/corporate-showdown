"""Lossless PNG IDAT recompression for generated builds; source assets stay intact."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import zlib

SIGNATURE = b'\x89PNG\r\n\x1a\n'
MAX_RAW = 256 * 1024 * 1024


def chunk(kind, payload):
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))


def optimize(data):
    if not data.startswith(SIGNATURE):
        raise ValueError('Invalid PNG signature')
    entries, offset, ended = [], 8, False
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError('Truncated PNG chunk')
        size = struct.unpack_from('>I', data, offset)[0]
        end = offset + size + 12
        if end > len(data):
            raise ValueError('Truncated PNG data')
        kind, payload = data[offset + 4:offset + 8], data[offset + 8:end - 4]
        if zlib.crc32(kind + payload) != struct.unpack_from('>I', data, end - 4)[0]:
            raise ValueError('PNG CRC mismatch')
        entries.append((kind, payload, data[offset:end]))
        offset = end
        if kind == b'IEND':
            ended = True
            break
    kinds = [e[0] for e in entries]
    padding = data[offset:]
    if not ended or (padding and (len(padding) > 3 or padding != b'\x00' * len(padding))) or kinds[0] != b'IHDR' or len(entries[0][1]) != 13:
        raise ValueError('Invalid PNG structure')
    if b'acTL' in kinds:
        return data, {'skipped': 'animated PNG'}
    positions = [i for i, kind in enumerate(kinds) if kind == b'IDAT']
    if not positions or positions != list(range(positions[0], positions[-1] + 1)):
        raise ValueError('Non-contiguous PNG IDAT')
    encoded = b''.join(entries[i][1] for i in positions)
    decoder = zlib.decompressobj()
    raw = decoder.decompress(encoded, MAX_RAW + 1)
    if len(raw) > MAX_RAW or not decoder.eof or decoder.unused_data:
        raise ValueError('Invalid or oversized PNG stream')
    encoded_new = zlib.compress(raw, 6)
    if zlib.decompress(encoded_new) != raw:
        raise ValueError('Lossless verification failed')
    result = SIGNATURE + b''.join(e[2] for e in entries[:positions[0]]) + chunk(b'IDAT', encoded_new) + b''.join(e[2] for e in entries[positions[-1] + 1:]) + padding
    # All color, transparency, palette and other metadata bytes are preserved verbatim.
    details = {'rawScanlinesSHA256': hashlib.sha256(raw).hexdigest(), 'metadataSHA256': hashlib.sha256(b''.join(e[2] for e in entries if e[0] != b'IDAT')).hexdigest(), 'preservedPaddingBytes': len(padding)}
    return (result if len(result) < len(data) else data), details


def run(root, report):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError('Build directory missing')
    entries, cache = [], {}
    for path in sorted(root.rglob('*.png')):
        if path.is_symlink():
            raise ValueError('Build PNG must not be a symlink')
        source = path.read_bytes()
        fingerprint = hashlib.sha256(source).hexdigest()
        if fingerprint not in cache:
            cache[fingerprint] = optimize(source)
        output, details = cache[fingerprint]
        if output != source:
            temporary = path.with_suffix('.png.optimizing')
            try:
                temporary.write_bytes(output)
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
        entries.append({'path': str(path.relative_to(root)), 'beforeBytes': len(source), 'afterBytes': len(output), 'beforeSHA256': fingerprint, 'afterSHA256': hashlib.sha256(output).hexdigest(), **details})
    result = {'scope': 'generated PNG file bytes only; no pixel or metadata change; no GPU memory reduction', 'beforeBytes': sum(e['beforeBytes'] for e in entries), 'afterBytes': sum(e['afterBytes'] for e in entries), 'uniqueInputs': len(cache), 'entries': entries}
    Path(report).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['beforeBytes', 'afterBytes', 'uniqueInputs']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('build')
    parser.add_argument('report')
    args = parser.parse_args()
    run(args.build, args.report)
