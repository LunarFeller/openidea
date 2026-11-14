from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(font_path, 30)
body = ImageFont.truetype(font_path, 23)
small = ImageFont.truetype(font_path, 20)

def card(phase, heading, conclusion, color):
    raw = Image.open(root / ('native-' + phase + '.png')).convert('RGB')
    meta = json.loads((root / ('native-' + phase + '-capture.json')).read_text())['data']
    scale = raw.width / meta['innerWidth']
    offset_y = max(0, raw.height - meta['innerHeight'] * scale)
    panel = meta['panelRect']
    avg = meta['averageRect']
    crop_box = (
        round(panel['x'] * scale),
        round(panel['y'] * scale + offset_y),
        round((panel['x'] + panel['width']) * scale),
        round((panel['y'] + min(panel['height'], 270)) * scale + offset_y),
    )
    crop = raw.crop(crop_box)
    fit = min(640 / crop.width, 540 / crop.height)
    if fit != 1:
        crop = crop.resize((round(crop.width * fit), round(crop.height * fit)), Image.LANCZOS)
    out = Image.new('RGB', (700, 805), '#f4f5f7')
    draw = ImageDraw.Draw(out)
    draw.text((30, 18), heading, font=title, fill='#17212b')
    draw.text((30, 65), '8192 numeric cells: one 1 and 8191 zeroes.', font=small, fill='#465361')
    draw.text((30, 93), 'Two NULL cells are excluded from the mean.', font=small, fill='#465361')
    x, y = 30, 135
    out.paste(crop, (x, y))
    rect = (
        x + (8 * scale) * fit,
        y + ((avg['y'] - panel['y'] - 1) * scale) * fit,
        x + ((panel['width'] - 8) * scale) * fit,
        y + ((avg['y'] - panel['y'] + avg['height'] + 1) * scale) * fit,
    )
    draw.rectangle(rect, outline=color, width=4)
    draw.text((30, 706), conclusion, font=body, fill=color)
    draw.text((30, 751), 'Native macOS app / real SQLite rows', font=small, fill='#596573')
    out.save(root / (phase + '-annotated.png'))
    return out

before = card('before', 'Before: the finite mean is rounded', 'Wrong Avg: 0.000122070313', '#b32a37')
after = card('after', 'After: the exact mean is preserved', 'Correct Avg: 0.0001220703125', '#16764f')
comparison = Image.new('RGB', (1416, 805), '#dce1e6')
comparison.paste(before, (0, 0))
comparison.paste(after, (716, 0))
comparison.save(root / 'native-comparison.png')
print('Annotated native captures with Pillow: crop, boxes and captions only.')
print('Raw sizes:', Image.open(root / 'native-before.png').size, Image.open(root / 'native-after.png').size)
