"""Compile the touch adapter and add its invisible sprite to the original timeline."""
import argparse
import struct
import subprocess
import tempfile
import zlib
from pathlib import Path


def tags(data):
    offset = (5 + (data[0] >> 3) * 4 + 7) // 8 + 4
    yield None, data[:offset]
    while offset < len(data):
        header, = struct.unpack_from("<H", data, offset)
        offset += 2
        size = header & 63
        if size == 63:
            size, = struct.unpack_from("<I", data, offset)
            offset += 4
        yield header >> 6, data[offset:offset + size]
        offset += size


def tag(kind, payload):
    size = len(payload)
    prefix = struct.pack("<H", kind << 6 | min(size, 63))
    return prefix + (struct.pack("<I", size) if size >= 63 else b"") + payload


def build(original, compiler, output):
    with tempfile.TemporaryDirectory() as temp:
        adapter = Path(temp) / "adapter.swf"
        subprocess.run([compiler, "-cp", str(Path(__file__).parent), "-main", "TouchPlayer",
                        "-swf", str(adapter), "-swf-version", "11.4"], check=True)
        compiled = dict(tags(zlib.decompress(adapter.read_bytes()[8:])))
    bytecode = compiled[82]
    document_class = compiled[76]
    assert document_class[:4] == b"\x01\x00\x00\x00"
    sprite_id = 65000
    depth = 16000
    sprite = struct.pack("<HH", sprite_id, 1) + tag(1, b"") + tag(0, b"")
    binding = struct.pack("<HH", 1, sprite_id) + document_class[4:]
    placement = struct.pack("<BHH", 2, depth, sprite_id)
    source = original.read_bytes()
    assert source[:3] == b"CWS"
    chunks = []
    inserted = False
    for kind, data in tags(zlib.decompress(source[8:])):
        if kind is None:
            chunks.append(data)
            continue
        if kind == 1 and not inserted:
            chunks.extend([tag(82, bytecode), tag(39, sprite), tag(76, binding), tag(26, placement)])
            inserted = True
        chunks.append(tag(kind, data))
    assert inserted
    body = b"".join(chunks)
    output.write_bytes(source[:4] + struct.pack("<I", len(body) + 8) + zlib.compress(body, 9))


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("original", type=Path)
    parser.add_argument("--haxe", default="haxe")
    args = parser.parse_args()
    build(args.original, args.haxe, root / "touch-player.swf")
