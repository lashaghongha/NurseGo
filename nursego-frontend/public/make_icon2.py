
from PIL import Image, ImageDraw, ImageFont

# Load original
img = Image.open("C:/Users/user/Downloads/Female-Nurse-Clipart-edit-online.webp").convert("RGBA")
w, h = img.size  # 1200x1200

# Crop out the "Female Nurse Clipart" text at top (~160px)
# The nurse figure starts around y=160 and goes to bottom
cropped = img.crop((150, 155, 1050, 1150))  # trim sides a bit too

def make_icon(size, fname):
    # Create blue-teal gradient background
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for i in range(size):
        t = i / size
        rc = int(3 + (14-3)*t)
        gc = int(105 + (165-105)*t)
        bc = int(161 + (197-161)*t)
        bg_draw.rectangle([(0, i), (size, i+1)], fill=(rc, gc, bc, 255))

    # Rounded corners mask for background
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(size * 0.18)
    mask_draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)

    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(bg, (0, 0), mask)

    # Resize cropped nurse to fit nicely in icon (leave room for banner at bottom)
    nurse_area_h = int(size * 0.82)
    nurse_area_w = int(size * 0.88)
    nurse = cropped.copy()
    nurse.thumbnail((nurse_area_w, nurse_area_h), Image.LANCZOS)
    nw, nh = nurse.size

    # Make white background transparent
    nurse_rgb = nurse.convert("RGBA")
    data = nurse_rgb.getdata()
    new_data = []
    for item in data:
        r, g, b, a = item
        # white/near-white pixels -> transparent
        if r > 230 and g > 230 and b > 230:
            new_data.append((r, g, b, 0))
        else:
            new_data.append(item)
    nurse_rgb.putdata(new_data)

    # Paste nurse centered horizontally, top-aligned with small top padding
    nx = (size - nw) // 2
    ny = int(size * 0.02)
    result.paste(nurse_rgb, (nx, ny), nurse_rgb)

    draw = ImageDraw.Draw(result)

    # Banner at bottom
    banner_y = int(size * 0.82)
    banner_h = int(size * 0.16)
    bx1, by1 = int(0.05*size), banner_y
    bx2, by2 = int(0.95*size), banner_y + banner_h
    br = max(4, int(size * 0.04))
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=br,
                            fill=(15, 25, 60), outline=(255, 255, 255),
                            width=max(2, int(size * 0.016)))

    text = "ექთანი"
    font_size = max(10, int(size * 0.115))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/sylfaen.ttf", font_size)
    except:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = banner_y + (banner_h - th) // 2 - bbox[1]

    stroke_w = max(1, int(size * 0.012))
    for dx in range(-stroke_w, stroke_w+1):
        for dy in range(-stroke_w, stroke_w+1):
            if dx*dx + dy*dy <= stroke_w*stroke_w + 1:
                draw.text((tx+dx, ty+dy), text, font=font, fill=(255, 255, 255))
    draw.text((tx, ty), text, font=font, fill=(255, 215, 40))

    # Icon border
    border = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle([0, 0, size-1, size-1], radius=int(size*0.18),
                          outline=(0, 50, 110, 200), width=max(2, int(size*0.016)))
    result = Image.alpha_composite(result, border)

    result.save(fname)
    print(f"Saved {fname}")

make_icon(512, "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo512.png")
make_icon(192, "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo192.png")

# favicon
sizes_ico = [16, 32, 48, 64, 128]
ico_imgs = []
for sz in sizes_ico:
    tmp_img = Image.new('RGBA', (sz, sz), (0,0,0,0))
    # just paste scaled version
    base = Image.open("C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo192.png").convert("RGBA")
    base = base.resize((sz, sz), Image.LANCZOS)
    ico_imgs.append(base)

ico_imgs[0].save(
    "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/favicon.ico",
    format='ICO',
    sizes=[(s, s) for s in sizes_ico],
    append_images=ico_imgs[1:]
)
print("Saved favicon.ico")
print("Done!")
