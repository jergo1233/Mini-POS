import zlib
import struct
import math
import os

def create_png(width, height, get_pixel):
    """
    Creates a PNG file using pure standard library.
    get_pixel(x, y) should return (r, g, b, a) where values are 0-255.
    """
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel(x, y)
            raw_data.extend((r, g, b, a))

    def make_chunk(chunk_type, data):
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)

    # PNG Signature
    png = b'\x89PNG\r\n\x1a\n'
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png += make_chunk(b'IHDR', ihdr_data)
    # IDAT
    compressed_data = zlib.compress(bytes(raw_data), 9)
    png += make_chunk(b'IDAT', compressed_data)
    # IEND
    png += make_chunk(b'IEND', b'')

    return png

def blend(fg, bg, alpha):
    """alpha is 0.0 to 1.0"""
    return (
        int(fg[0] * alpha + bg[0] * (1 - alpha)),
        int(fg[1] * alpha + bg[1] * (1 - alpha)),
        int(fg[2] * alpha + bg[2] * (1 - alpha)),
        int(fg[3] * alpha + bg[3] * (1 - alpha))
    )

def render_pos_icon(size, is_maskable=False):
    # Normalized coords from 0.0 to 1.0
    # Center is (0.5, 0.5)
    scale = 0.72 if is_maskable else 0.88

    def get_pixel(px, py):
        nx = (px + 0.5) / size
        ny = (py + 0.5) / size

        # Background gradient: Blue #2563eb (37, 99, 235) to #1d4ed8 (29, 78, 216)
        t = ny
        bg_r = int(37 * (1 - t) + 29 * t)
        bg_g = int(99 * (1 - t) + 78 * t)
        bg_b = int(235 * (1 - t) + 216 * t)

        if is_maskable:
            # Full bleed solid background
            base_color = (bg_r, bg_g, bg_b, 255)
        else:
            # Rounded squircle for standard icons
            # Distance from center with superellipse or rounded rect
            rx = abs(nx - 0.5)
            ry = abs(ny - 0.5)
            corner_r = 0.22
            box_w = 0.46
            box_h = 0.46

            dx = max(0.0, rx - (box_w - corner_r))
            dy = max(0.0, ry - (box_h - corner_r))
            dist = math.sqrt(dx * dx + dy * dy)
            edge_dist = corner_r - dist

            # Antialiasing on squircle edge
            pixel_w = 1.0 / size
            if edge_dist < -pixel_w:
                return (0, 0, 0, 0)
            elif edge_dist < 0:
                alpha = max(0.0, min(1.0, (edge_dist + pixel_w) / pixel_w))
                base_color = (bg_r, bg_g, bg_b, int(255 * alpha))
            else:
                base_color = (bg_r, bg_g, bg_b, 255)

        # Draw the POS Terminal Icon Graphic centered at (0.5, 0.5)
        # Transform coords into normalized icon space (-1.0 to 1.0)
        cx = (nx - 0.5) / (scale * 0.5)
        cy = (ny - 0.5) / (scale * 0.5)

        # Icon Elements:
        # 1. Main Terminal Screen (Rotated/angled tablet or monitor)
        # Box from x: -0.62 to +0.62, y: -0.55 to +0.12, with rounded corners
        screen_w = 0.62
        screen_h = 0.33
        screen_cy = -0.22
        
        # Check if inside screen body
        sx = abs(cx) - (screen_w - 0.08)
        sy = abs(cy - screen_cy) - (screen_h - 0.08)
        screen_dist = math.sqrt(max(0.0, sx)**2 + max(0.0, sy)**2) - 0.08

        # Drop shadow for terminal
        shadow_dist = math.sqrt(max(0.0, abs(cx) - 0.56)**2 + max(0.0, abs(cy - (screen_cy + 0.05)) - 0.35)**2) - 0.08
        if shadow_dist < 0.06 and cy > 0.0:
            shadow_alpha = (1.0 - (shadow_dist / 0.06)) * 0.35
            base_color = blend((15, 23, 42, 255), base_color, shadow_alpha)

        # Base Stand: x: -0.42 to +0.42, y: +0.22 to +0.55
        base_top_w = 0.22
        base_bot_w = 0.48
        if 0.12 <= cy <= 0.58:
            interp = (cy - 0.12) / (0.58 - 0.12)
            cur_w = base_top_w * (1 - interp) + base_bot_w * interp
            if abs(cx) <= cur_w:
                # Stand shading
                stand_color = (241, 245, 249, 255) if cy < 0.52 else (226, 232, 240, 255)
                base_color = stand_color

        # Terminal Screen Front (White frame)
        if screen_dist <= 0:
            # Inside screen outer border (White / Light Slate)
            base_color = (255, 255, 255, 255)

            # Inner Screen Glass: x: -0.52 to +0.52, cy -0.22 +- 0.25
            inner_sx = abs(cx) - (0.52 - 0.04)
            inner_sy = abs(cy - screen_cy) - (0.24 - 0.04)
            inner_dist = math.sqrt(max(0.0, inner_sx)**2 + max(0.0, inner_sy)**2) - 0.04
            
            if inner_dist <= 0:
                # Screen Glass: Slate Blue / Dark theme #0f172a
                base_color = (15, 23, 42, 255)

                # Top Status bar line on screen (Cyan/Blue #38bdf8)
                if -0.42 <= cy <= -0.38 and abs(cx) <= 0.44:
                    base_color = (56, 189, 248, 255)

                # Price / Total Display pill (Emerald Green #10b981)
                # Box at cx: -0.1 to +0.42, cy: -0.32 to -0.18
                if -0.32 <= cy <= -0.18 and -0.10 <= cx <= 0.42:
                    base_color = (16, 185, 129, 255)
                
                # Product item lines on screen
                if -0.12 <= cy <= -0.08 and -0.42 <= cx <= 0.42:
                    base_color = (148, 163, 184, 255)
                if -0.04 <= cy <= -0.00 and -0.42 <= cx <= 0.20:
                    base_color = (100, 116, 139, 255)

                # Shopping cart icon or checkout symbol on left of screen
                cart_cx = -0.28
                cart_cy = -0.25
                if math.sqrt((cx - cart_cx)**2 + (cy - cart_cy)**2) <= 0.06:
                    base_color = (255, 255, 255, 255)

        # Receipt Slot & Printed Paper coming out of top or side
        # Receipt Paper: cx: -0.18 to +0.18, cy: -0.68 to -0.48
        if -0.68 <= cy <= -0.48 and abs(cx) <= 0.20:
            # Paper color: Clean white with faint lines
            base_color = (248, 250, 252, 255)
            # Faint receipt lines
            if (-0.62 <= cy <= -0.60 or -0.56 <= cy <= -0.54) and abs(cx) <= 0.14:
                base_color = (148, 163, 184, 255)

        # Front Scanner / Barcode Symbol on base
        # cx: -0.24 to +0.24, cy: +0.34 to +0.42
        if 0.34 <= cy <= 0.44 and abs(cx) <= 0.26:
            # Barcode stripes
            bar_idx = int((cx + 0.26) / 0.038)
            if bar_idx % 2 == 0:
                base_color = (37, 99, 235, 255)
            else:
                base_color = (255, 255, 255, 255)

        return base_color

    return create_png(size, size, get_pixel)

def main():
    os.makedirs('public', exist_ok=True)
    print("Generating PWA Icon Assets...")

    # 1. 192x192 Standard Icon
    png_192 = render_pos_icon(192, is_maskable=False)
    with open('public/pwa-192x192.png', 'wb') as f:
        f.write(png_192)
    with open('public/icon-192.png', 'wb') as f:
        f.write(png_192)
    print("✓ Created public/pwa-192x192.png & public/icon-192.png")

    # 2. 512x512 Standard Icon
    png_512 = render_pos_icon(512, is_maskable=False)
    with open('public/pwa-512x512.png', 'wb') as f:
        f.write(png_512)
    with open('public/icon-512.png', 'wb') as f:
        f.write(png_512)
    print("✓ Created public/pwa-512x512.png & public/icon-512.png")

    # 3. 512x512 Maskable Icon (safe zone margin)
    png_maskable = render_pos_icon(512, is_maskable=True)
    with open('public/pwa-maskable-512x512.png', 'wb') as f:
        f.write(png_maskable)
    print("✓ Created public/pwa-maskable-512x512.png")

    # 4. 180x180 Apple Touch Icon (iOS Safari)
    png_180 = render_pos_icon(180, is_maskable=False)
    with open('public/apple-touch-icon.png', 'wb') as f:
        f.write(png_180)
    print("✓ Created public/apple-touch-icon.png")

if __name__ == '__main__':
    main()
