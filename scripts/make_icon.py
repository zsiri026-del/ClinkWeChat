"""生成应用图标 v2：深绿渐变圆角方块 + 白色客服耳麦 + 在线状态点。纯标准库实现。"""
import os
import struct
import zlib

S = 256
M = 14          # 外边距
R = 56          # 圆角半径

TOP = (22, 199, 132)     # #16C784
BOTTOM = (4, 133, 96)    # #048560
WHITE = (255, 255, 255)


def rounded_rect_cov(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return 0
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return 1 if (x - cx) ** 2 + (y - cy) ** 2 <= r * r else 0


def circle_cov(x, y, cx, cy, r):
    return 1 if (x - cx) ** 2 + (y - cy) ** 2 <= r * r else 0


def headband_cov(x, y, cx, cy, r_in, r_out, y_max):
    """上半环（头梁）"""
    if y > y_max:
        return 0
    d2 = (x - cx) ** 2 + (y - cy) ** 2
    return 1 if r_in * r_in <= d2 <= r_out * r_out else 0


def headset_cov(x, y):
    # 整体缩放 0.9 并向左上偏移，为右下角状态点留出空间
    xl = 128 + (x + 10 - 128) / 0.9
    yl = 128 + (y + 12 - 128) / 0.9
    x, y = xl, yl

    # 头梁
    if headband_cov(x, y, 128, 134, 56, 74, 140):
        return 1
    # 左右耳罩
    if rounded_rect_cov(x, y, 46, 118, 88, 182, 17):
        return 1
    if rounded_rect_cov(x, y, 168, 118, 210, 182, 17):
        return 1
    # 麦克风拾音臂（左下弧线）
    if headband_cov(x, y, 128, 120, 88, 100, 220) and y > 158 and x < 120:
        return 1
    return 0


def build():
    px = bytearray(S * S * 4)
    subs = [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)]

    dot_c = (206, 206)
    ring_r = 31
    inner_r = 14
    dot_green = (52, 226, 148)

    for y in range(S):
        for x in range(S):
            bg = 0
            fg = 0
            ring = 0
            inner = 0
            for sx, sy in subs:
                px_x, px_y = x + sx, y + sy
                if rounded_rect_cov(px_x, px_y, M, M, S - M, S - M, R):
                    bg += 1
                    fg += headset_cov(px_x, px_y)
                    if circle_cov(px_x, px_y, dot_c[0], dot_c[1], ring_r):
                        ring += 1
                        if circle_cov(px_x, px_y, dot_c[0], dot_c[1], inner_r):
                            inner += 1
            bg /= 4.0
            fg /= 4.0
            ring /= 4.0
            inner /= 4.0
            if bg <= 0:
                continue

            t = (y * 0.85 + x * 0.15) / (S - 1)
            col = [TOP[i] * (1 - t) + BOTTOM[i] * t for i in range(3)]

            # 在线状态点：白色描边 + 亮绿圆点
            if ring > 0:
                col = [col[i] * (1 - ring) + WHITE[i] * ring for i in range(3)]
                if inner > 0:
                    col = [col[i] * (1 - inner) + dot_green[i] * inner for i in range(3)]

            # 耳麦前景
            if fg > 0:
                col = [WHITE[i] * fg + col[i] * (1 - fg) for i in range(3)]

            i = (y * S + x) * 4
            px[i] = int(col[0])
            px[i + 1] = int(col[1])
            px[i + 2] = int(col[2])
            px[i + 3] = int(255 * bg)
    return bytes(px)


def write_png(path, rgba):
    raw = bytearray()
    stride = S * 4
    for y in range(S):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def write_ico(path, rgba):
    rows = []
    for y in range(S - 1, -1, -1):
        row = bytearray()
        for x in range(S):
            i = (y * S + x) * 4
            r, g, b, a = rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]
            row += bytes((b, g, r, a))
        rows.append(bytes(row))
    pixels = b"".join(rows)
    mask = b"\x00" * (32 * S)
    bmp = struct.pack("<IiiHHIIiiII", 40, S, S * 2, 1, 32, 0, len(pixels), 0, 0, 0, 0)
    image = bmp + pixels + mask
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(image), 22)
    with open(path, "wb") as f:
        f.write(header + entry + image)


if __name__ == "__main__":
    out = os.path.join(os.environ["LOCALAPPDATA"], "Programs", "ClinkWeChat", "assets")
    os.makedirs(out, exist_ok=True)
    data = build()
    write_png(os.path.join(out, "icon-v2.png"), data)
    write_ico(os.path.join(out, "icon-v2.ico"), data)
    for old in ("icon.png", "icon.ico"):
        p = os.path.join(out, old)
        if os.path.exists(p):
            os.remove(p)
    print("icon v2 ok ->", out)
