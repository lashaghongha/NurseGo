
from PIL import Image, ImageDraw, ImageFont
import math

def make_nurse_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size

    def p(x, y): return (int(x * s), int(y * s))
    def r(x, y, w, h): return [int(x*s), int(y*s), int((x+w)*s), int((y+h)*s)]

    # --- Background gradient (blue->teal) with rounded corners ---
    bg = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for i in range(s):
        t = i / s
        rc = int(3 + (14-3)*t)
        gc = int(105 + (165-105)*t)
        bc = int(161 + (197-161)*t)
        bg_draw.rectangle([(0, i), (s, i+1)], fill=(rc, gc, bc, 255))
    mask = Image.new('L', (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(s * 0.18)
    mask_draw.rounded_rectangle([0, 0, s-1, s-1], radius=radius, fill=255)
    img.paste(bg, (0, 0), mask)
    draw = ImageDraw.Draw(img)

    # =================== FIGURE ==================
    skin = (245, 195, 155)
    hair_color = (70, 35, 15)
    coat_color = (245, 248, 255)
    teal_scrub = (20, 184, 166)

    # --- Hair back ---
    draw.ellipse(r(0.27, 0.09, 0.46, 0.44), fill=hair_color)
    draw.ellipse(r(0.21, 0.19, 0.16, 0.24), fill=hair_color)
    draw.ellipse(r(0.60, 0.19, 0.19, 0.24), fill=hair_color)

    # --- Neck ---
    draw.rectangle(r(0.44, 0.41, 0.12, 0.09), fill=skin)

    # --- White coat body ---
    body_pts = [p(0.18, 0.93), p(0.82, 0.93), p(0.76, 0.51), p(0.24, 0.51)]
    draw.polygon(body_pts, fill=coat_color)
    # teal scrub under coat
    draw.polygon([p(0.37, 0.53), p(0.63, 0.53), p(0.65, 0.76), p(0.35, 0.76)], fill=teal_scrub)
    # coat lapels
    lapel_color = (220, 232, 248)
    draw.polygon([p(0.40, 0.52), p(0.50, 0.65), p(0.33, 0.73), p(0.26, 0.60)], fill=lapel_color)
    draw.polygon([p(0.60, 0.52), p(0.50, 0.65), p(0.67, 0.73), p(0.74, 0.60)], fill=lapel_color)
    # coat collar shoulders
    draw.polygon([p(0.24, 0.51), p(0.41, 0.51), p(0.37, 0.58), p(0.21, 0.63)], fill=coat_color)
    draw.polygon([p(0.76, 0.51), p(0.59, 0.51), p(0.63, 0.58), p(0.79, 0.63)], fill=coat_color)

    # --- RIGHT ARM pointing up ---
    arm_pts_r = [p(0.68, 0.54), p(0.82, 0.46), p(0.89, 0.30), p(0.81, 0.26), p(0.73, 0.43), p(0.62, 0.51)]
    draw.polygon(arm_pts_r, fill=coat_color)
    draw.polygon([p(0.82, 0.33), p(0.89, 0.30), p(0.87, 0.25), p(0.80, 0.26)], fill=teal_scrub)
    # hand
    draw.ellipse(r(0.77, 0.19, 0.14, 0.13), fill=skin)
    # pointing finger
    finger_pts = [p(0.835, 0.19), p(0.845, 0.07), p(0.870, 0.07), p(0.880, 0.19)]
    draw.polygon(finger_pts, fill=skin)
    draw.line([p(0.835, 0.19), p(0.845, 0.07), p(0.870, 0.07), p(0.880, 0.19)],
              fill=(200, 140, 100), width=max(1, int(s*0.008)))
    draw.line([p(0.837, 0.148), p(0.878, 0.148)], fill=(200, 140, 100), width=max(1, int(s*0.005)))

    # --- LEFT ARM on hip ---
    arm_l_pts = [p(0.22, 0.57), p(0.13, 0.67), p(0.14, 0.81), p(0.27, 0.82), p(0.29, 0.68), p(0.30, 0.57)]
    draw.polygon(arm_l_pts, fill=coat_color)
    draw.ellipse(r(0.11, 0.77, 0.16, 0.10), fill=skin)

    # --- FACE ---
    draw.ellipse(r(0.29, 0.11, 0.42, 0.35), fill=skin)

    # --- Hair front & bangs ---
    draw.arc(r(0.28, 0.10, 0.44, 0.20), start=200, end=340, fill=hair_color, width=max(2, int(s*0.045)))
    draw.polygon([p(0.29, 0.22), p(0.33, 0.13), p(0.40, 0.12), p(0.51, 0.14),
                  p(0.51, 0.19), p(0.39, 0.16), p(0.32, 0.23)], fill=hair_color)

    # face highlight
    draw.ellipse(r(0.35, 0.16, 0.11, 0.09), fill=(255, 215, 175, 100))

    # --- Eyes ---
    # left
    draw.ellipse(r(0.325, 0.248, 0.090, 0.080), fill=(255, 255, 255))
    draw.ellipse(r(0.338, 0.252, 0.064, 0.072), fill=(55, 110, 55))
    draw.ellipse(r(0.350, 0.260, 0.040, 0.056), fill=(15, 15, 15))
    draw.ellipse(r(0.352, 0.262, 0.014, 0.014), fill=(255, 255, 255))
    # right
    draw.ellipse(r(0.435, 0.248, 0.090, 0.080), fill=(255, 255, 255))
    draw.ellipse(r(0.448, 0.252, 0.064, 0.072), fill=(55, 110, 55))
    draw.ellipse(r(0.460, 0.260, 0.040, 0.056), fill=(15, 15, 15))
    draw.ellipse(r(0.462, 0.262, 0.014, 0.014), fill=(255, 255, 255))
    # eyelashes top
    lash_w = max(2, int(s*0.020))
    draw.arc(r(0.323, 0.244, 0.094, 0.050), start=200, end=340, fill=(20,20,20), width=lash_w)
    draw.arc(r(0.433, 0.244, 0.094, 0.050), start=200, end=340, fill=(20,20,20), width=lash_w)
    # eyebrows
    brow_w = max(2, int(s*0.020))
    draw.arc(r(0.318, 0.228, 0.100, 0.044), start=205, end=335, fill=hair_color, width=brow_w)
    draw.arc(r(0.430, 0.228, 0.100, 0.044), start=205, end=335, fill=hair_color, width=brow_w)

    # nose
    draw.ellipse(r(0.484, 0.305, 0.024, 0.016), fill=(220, 160, 120))

    # smile
    draw.arc(r(0.358, 0.328, 0.134, 0.062), start=22, end=158, fill=(180, 70, 70), width=max(2, int(s*0.016)))
    draw.arc(r(0.361, 0.331, 0.128, 0.054), start=22, end=158, fill=(255, 255, 255), width=max(1, int(s*0.010)))

    # blush cheeks
    blush = (255, 175, 145, 110)
    draw.ellipse(r(0.305, 0.312, 0.072, 0.042), fill=blush)
    draw.ellipse(r(0.474, 0.312, 0.072, 0.042), fill=blush)

    # --- NURSE CAP ---
    cap_pts = [p(0.27, 0.21), p(0.73, 0.21), p(0.69, 0.13), p(0.31, 0.13)]
    draw.polygon(cap_pts, fill=(250, 252, 255))
    draw.rectangle(r(0.27, 0.195, 0.46, 0.022), fill=(230, 238, 252))
    cx2, cy2, cs2 = 0.50, 0.168, 0.062
    draw.rectangle(r(cx2-cs2/4, cy2-cs2/2, cs2/2, cs2), fill=(220, 35, 35))
    draw.rectangle(r(cx2-cs2/2, cy2-cs2/4, cs2, cs2/2), fill=(220, 35, 35))
    draw.line([p(0.27, 0.21), p(0.73, 0.21)], fill=(195, 210, 232), width=max(1, int(s*0.008)))

    # --- Stethoscope ---
    steth = (70, 70, 90)
    draw.arc(r(0.35, 0.57, 0.30, 0.16), start=12, end=168, fill=steth, width=max(2, int(s*0.018)))
    draw.ellipse(r(0.455, 0.72, 0.09, 0.065), fill=steth)

    # --- Badge ---
    draw.rectangle(r(0.544, 0.598, 0.082, 0.062), fill=(210, 35, 35))
    bx2, by2b, bs2 = 0.585, 0.629, 0.026
    draw.rectangle(r(bx2-bs2/4, by2b-bs2/2, bs2/2, bs2), fill=(255,255,255))
    draw.rectangle(r(bx2-bs2/2, by2b-bs2/4, bs2, bs2/2), fill=(255,255,255))

    # =================== BANNER ==================
    banner_y = 0.815
    banner_h = 0.175
    bx1 = int(0.06*s); by1 = int(banner_y*s)
    bx2b = int(0.94*s); by2c = int((banner_y+banner_h)*s)
    br2 = max(4, int(s*0.042))
    # shadow
    draw.rounded_rectangle([bx1+2, by1+3, bx2b+2, by2c+3], radius=br2, fill=(0,0,0,80))
    # main banner
    draw.rounded_rectangle([bx1, by1, bx2b, by2c], radius=br2,
                            fill=(15, 25, 60), outline=(255, 255, 255), width=max(2, int(s*0.018)))

    text = "ექთანი"
    font_size = max(10, int(s * 0.120))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/sylfaen.ttf", font_size)
    except:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (s - tw) // 2 - bbox[0]
    ty = int((banner_y + banner_h/2) * s) - th//2 - bbox[1]

    stroke_w = max(1, int(s * 0.013))
    for dx in range(-stroke_w, stroke_w+1):
        for dy in range(-stroke_w, stroke_w+1):
            if dx*dx + dy*dy <= stroke_w*stroke_w + 1:
                draw.text((tx+dx, ty+dy), text, font=font, fill=(255, 255, 255))
    draw.text((tx, ty), text, font=font, fill=(255, 215, 40))

    # --- Icon border ---
    outline_img = Image.new('RGBA', (s, s), (0,0,0,0))
    od = ImageDraw.Draw(outline_img)
    od.rounded_rectangle([0, 0, s-1, s-1], radius=int(s*0.18),
                          outline=(0, 50, 110, 200), width=max(2, int(s*0.018)))
    img = Image.alpha_composite(img, outline_img)

    return img

# Generate
for sz, fname in [(192, 'logo192.png'), (512, 'logo512.png')]:
    img = make_nurse_icon(sz)
    img.save(fname)
    print(f"Saved {fname}")

icons = [make_nurse_icon(sz) for sz in [16, 32, 48, 64, 128]]
icons[0].save('favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128)],
              append_images=icons[1:])
print("Saved favicon.ico")
print("Done!")
