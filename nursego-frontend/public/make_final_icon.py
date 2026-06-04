
from PIL import Image, ImageDraw, ImageFont

src = Image.open("C:/Users/user/Downloads/Screenshot 2026-06-04 153316.png").convert("RGBA")

# Remove white background only (pure/near-white at edges)
# We'll use flood-fill approach from corners to only remove bg, not the uniform
def remove_bg(img, threshold=238):
    from collections import deque
    img = img.copy()
    pixels = img.load()
    w, h = img.size
    visited = [[False]*h for _ in range(w)]
    queue = deque()
    # seed from all 4 edges
    for x in range(w):
        queue.append((x, 0)); queue.append((x, h-1))
    for y in range(h):
        queue.append((0, y)); queue.append((w-1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        if visited[x][y]:
            continue
        visited[x][y] = True
        r, g, b, a = pixels[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            pixels[x, y] = (r, g, b, 0)
            for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                queue.append((x+dx, y+dy))
    return img

nurse_transparent = remove_bg(src, threshold=238)

def make_icon(size, fname):
    s = size

    # Sky blue gradient background
    bg = Image.new('RGBA', (s, s), (0,0,0,0))
    bgd = ImageDraw.Draw(bg)
    for i in range(s):
        t = i / s
        rc = int(14 + (56-14)*t)
        gc = int(165 + (189-165)*t)
        bc = int(233 + (212-233)*t)
        bgd.rectangle([(0, i), (s, i+1)], fill=(rc, gc, bc, 255))

    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s-1, s-1], radius=int(s*0.18), fill=255)
    result = Image.new('RGBA', (s, s), (0,0,0,0))
    result.paste(bg, (0,0), mask)

    # Resize nurse
    nurse = nurse_transparent.copy()
    max_w = int(s * 0.90)
    max_h = int(s * 0.88)
    nurse.thumbnail((max_w, max_h), Image.LANCZOS)
    nw, nh = nurse.size
    nx = (s - nw) // 2
    ny = int(s * 0.03)

    # Drop shadow under nurse figure
    shadow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    shadow_layer = Image.new('RGBA', (nw, nh), (0, 0, 0, 0))
    nurse_pixels = nurse.load()
    shadow_pixels = shadow_layer.load()
    for y in range(nh):
        for x in range(nw):
            a = nurse_pixels[x, y][3]
            if a > 30:
                shadow_pixels[x, y] = (0, 0, 0, int(a * 0.35))
    shadow_offset = max(3, int(s * 0.012))
    shadow.paste(shadow_layer, (nx + shadow_offset, ny + shadow_offset), shadow_layer)
    # blur shadow slightly by pasting twice offset
    shadow.paste(shadow_layer, (nx + shadow_offset + 1, ny + shadow_offset + 1), shadow_layer)
    result = Image.alpha_composite(result, shadow)
    result.paste(nurse, (nx, ny), nurse)

    draw = ImageDraw.Draw(result)

    # Banner
    banner_y = int(s * 0.835)
    banner_h = int(s * 0.155)
    bx1, bx2 = int(0.04*s), int(0.96*s)
    by1, by2 = banner_y, banner_y + banner_h
    br = max(4, int(s * 0.04))
    draw.rounded_rectangle([bx1+2, by1+3, bx2+2, by2+3], radius=br, fill=(0,0,0,60))
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=br,
                            fill=(10, 20, 80), outline=(10, 20, 80),
                            width=1)

    text = "ექთანი"
    font_size = max(10, int(s * 0.135))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/sylfaen.ttf", font_size)
    except:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0,0), text, font=font)
    tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
    tx = (s-tw)//2 - bbox[0]
    ty = banner_y + (banner_h-th)//2 - bbox[1]

    # text shadow only (no white outline)
    draw.text((tx+2, ty+2), text, font=font, fill=(0, 0, 0, 120))
    draw.text((tx, ty), text, font=font, fill=(255, 215, 40))

    border = Image.new('RGBA', (s,s), (0,0,0,0))
    ImageDraw.Draw(border).rounded_rectangle([0,0,s-1,s-1], radius=int(s*0.18),
                                              outline=(0,80,160,180), width=max(2,int(s*0.015)))
    result = Image.alpha_composite(result, border)
    result.save(fname)
    print(f"Saved {fname}")

make_icon(512, "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo512.png")
make_icon(192, "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo192.png")

base = Image.open("C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo192.png")
ico_imgs = [base.resize((sz,sz), Image.LANCZOS) for sz in [16,32,48,64,128]]
ico_imgs[0].save("C:/Users/user/Desktop/NurseGo/nursego-frontend/public/favicon.ico",
    format='ICO', sizes=[(sz,sz) for sz in [16,32,48,64,128]], append_images=ico_imgs[1:])

import shutil
shutil.copy("C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo512.png",
            "C:/Users/user/Downloads/nursego_icon_preview.png")
print("Done! Preview saved to Downloads.")
