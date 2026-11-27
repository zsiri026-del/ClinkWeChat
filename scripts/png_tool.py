"""极简 PNG 读取/裁剪/放大工具（纯标准库），用于检查截图局部细节。"""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos = 8
    idat = b""
    w = h = bit = ctype = comp = filt = interlace = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if tag == b"IHDR":
            if len(chunk) < 13:
                raise ValueError("Invalid IHDR chunk")
            w, h, bit, ctype, comp, filt, interlace = struct.unpack(">IIBBBBB", chunk[:13])
        elif tag == b"IDAT":
            idat += chunk
        pos += 12 + length
    if interlace != 0:
        raise ValueError(f"Unsupported interlaced PNG (interlace={interlace})")
    if comp != 0 or filt != 0:
        raise ValueError(f"Unsupported PNG compression/filter ({comp}, {filt})")
    assert bit == 8 and ctype in (2, 6), (bit, ctype)
    ch = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(w * h * ch)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                left = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, ch, bytes(out)


def write_png(path, w, h, ch, pixels):
    ctype = 6 if ch == 4 else 2
    raw = bytearray()
    stride = w * ch
    for y in range(h):
        raw.append(0)
        raw += pixels[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ctype, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)


def crop_scale(src, dst, x0, y0, cw, ch_, scale):
    w, h, ch, px = read_png(src)
    x0 = max(0, min(x0, w - 1))
    y0 = max(0, min(y0, h - 1))
    cw = min(cw, w - x0)
    ch_ = min(ch_, h - y0)
    out_w, out_h = cw * scale, ch_ * scale
    out = bytearray(out_w * out_h * ch)
    for y in range(out_h):
        sy = y0 + y // scale
        for x in range(out_w):
            sx = x0 + x // scale
            si = (sy * w + sx) * ch
            di = (y * out_w + x) * ch
            out[di:di + ch] = px[si:si + ch]
    write_png(dst, out_w, out_h, ch, bytes(out))
    return out_w, out_h


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    x0, y0, cw, chh = (int(v) for v in sys.argv[3:7])
    scale = int(sys.argv[7]) if len(sys.argv) > 7 else 3
    print("crop", crop_scale(src, dst, x0, y0, cw, chh, scale))
