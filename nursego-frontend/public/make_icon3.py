
from PIL import Image, ImageDraw, ImageFont

# Load original clipart
src = Image.open("C:/Users/user/Downloads/Female-Nurse-Clipart-edit-online.webp").convert("RGBA")

# Crop: remove top text (rows 0-155) and small side margins
# Nurse figure: y=156 to y=1092, roughly x=230 to x=970
nurse_crop = src.crop((220, 156, 980, 1095))

# Make white/near-white background transparent using alpha_composite approach
def remove_white_bg(img, threshold=240):
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
    return img

nurse_transparent = remove_white_bg(nurse_crop, threshold=238)

def make_icon(size, fname):
    s = size
    # Gradient background
    bg = Image.new('RGBA', (s, s), (0,0,0,0))
    bgd = ImageDraw.Draw(bg)
    for i in range(s):
        t = i / s
        rc = int(3 + (14-3)*t)
        gc = int(105 + (165-105)*t)
        bc = int(161 + (197-161)*t)
        bgd.rectangle([(0,i),(s,i+1)], fill=(rc,gc,bc,255))

    # Rounded corners
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,s-1,s-1], radius=int(s*0.18), fill=255)
    result = Image.new('RGBA', (s, s), (0,0,0,0))
    result.paste(bg, (0,0), mask)

    # Resize nurse to fit: 88% width, 80% height (leave bottom for banner)
    max_w = int(s * 0.88)
    max_h = int(s * 0.80)
    nurse = nurse_transparent.copy()
    nurse.thumbnail((max_w, max_h), Image.LANCZOS)
    nw, nh = nurse.size

    # Center horizontally, start from top with small padding
    nx = (s - nw) // 2
    ny = int(s * 0.01)
    result.paste(nurse, (nx, ny), nurse)

    draw = ImageDraw.Draw(result)

    # Banner
    banner_y = int(s * 0.815)
    banner_h = int(s * 0.165)
    bx1, bx2 = int(0.05*s), int(0.95*s)
    by1, by2 = banner_y, banner_y + banner_h
    br = max(4, int(s * 0.04))
    # shadow
    draw.rounded_rectangle([bx1+2, by1+3, bx2+2, by2+3], radius=br, fill=(0,0,0,70))
    # banner
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=br,
                            fill=(15, 25, 60), outline=(255,255,255),
                            width=max(2, int(s*0.016)))

    text = "ექთანი"
    font_size = max(10, int(s * 0.115))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/sylfaen.ttf", font_size)
    except:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0,0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (s - tw) // 2 - bbox[0]
    ty = banner_y + (banner_h - th) // 2 - bbox[1]

    sw = max(1, int(s * 0.012))
    for dx in range(-sw, sw+1):
        for dy in range(-sw, sw+1):
            if dx*dx + dy*dy <= sw*sw + 1:
                draw.text((tx+dx, ty+dy), text, font=font, fill=(255,255,255))
    draw.text((tx, ty), text, font=font, fill=(255, 215, 40))

    # Border
    border = Image.new('RGBA', (s,s), (0,0,0,0))
    ImageDraw.Draw(border).rounded_rectangle([0,0,s-1,s-1], radius=int(s*0.18),
                                              outline=(0,50,110,180), width=max(2,int(s*0.016)))
    result = Image.alpha_composite(result, border)
    result.save(fname)
    print(f"Saved {fname}")

make_icon(512, "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo512.png")
make_icon(192, "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo192.png")

# favicon from 192
base192 = Image.open("C:/Users/user/Desktop/NurseGo/nursego-frontend/public/logo192.png")
ico_imgs = [base192.resize((sz,sz), Image.LANCZOS) for sz in [16,32,48,64,128]]
ico_imgs[0].save(
    "C:/Users/user/Desktop/NurseGo/nursego-frontend/public/favicon.ico",
    format='ICO', sizes=[(s,s) for s in [16,32,48,64,128]],
    append_images=ico_imgs[1:]
)
print("Saved favicon.ico\nDone!")
