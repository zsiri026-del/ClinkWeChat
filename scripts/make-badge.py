"""生成任务栏角标：红点 + 白边（32x32 PNG）。纯标准库实现。"""
import os
import struct
import zlib

S = 32
RED = (245, 51, 63)
WHITE = (255, 255, 255)


def write_png(path, pixels):
    raw = bytearray()
    stride = S * 4
    for y in range(S):
        raw.append(0)
        raw += pixels[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    cx = cy = S / 2 - 0.5
    r_out = 15.0     # 白边外径
    r_in = 12.0      # 红点半径
    subs = [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)]
    px = bytearray(S * S * 4)

    for y in range(S):
        for x in range(S):
            ring = 0
            dot = 0
            for sx, sy in subs:
                dx, dy = x + sx - cx, y + sy - cy
                d2 = dx * dx + dy * dy
                if d2 <= r_out * r_out:
                    ring += 1
                    if d2 <= r_in * r_in:
                        dot += 1
            ring /= 4.0
            dot /= 4.0
            if ring <= 0:
                continue
            col = [WHITE[i] * (1 - dot) + RED[i] * dot for i in range(3)]
            i = (y * S + x) * 4
            px[i] = int(col[0])
            px[i + 1] = int(col[1])
            px[i + 2] = int(col[2])
            px[i + 3] = int(255 * ring)

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "badge.png")
    write_png(out, bytes(px))
    print("badge ok ->", out)


if __name__ == "__main__":
    main()
