from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = Path(__file__).resolve().parent
font = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(font, 29)
heading = ImageFont.truetype(font, 26)
body = ImageFont.truetype(font, 22)
small = ImageFont.truetype(font, 19)
out = Image.new('RGB', (1540, 440), '#f3f5f7')
d = ImageDraw.Draw(out)
d.text((24, 14), "Select 'keep' in 'keep prompt', then paste an image", font=title, fill='#17212b')
d.text((24, 55), 'Native macOS WebView; replayed Linux empty-data event, image reply stubbed', font=small, fill='#53606c')
crop = (760, 760, 1850, 1040)
scale = 734 / (crop[2] - crop[0])
for phase, x, color, label, conclusion in [
    ('before', 24, '#bd2a36', "Before: 'keep' is deleted", 'The image attaches, but the selected word disappears.'),
    ('after', 790, '#147b50', "After: 'keep prompt' is preserved", 'The image attaches; the text and selection stay intact.'),
]:
    raw = Image.open(p / ('native-' + phase + '.png')).convert('RGB')
    assert raw.size == (2880, 1770), raw.size
    d.text((x, 103), label, font=heading, fill=color)
    cut = raw.crop(crop).resize((734, round((crop[3] - crop[1]) * scale)), Image.Resampling.LANCZOS)
    out.paste(cut, (x, 147))
    left = x + (393 * 2 - crop[0]) * scale - 5
    top = 147 + (433.90625 * 2 - crop[1]) * scale - 4
    right = left + 209
    bottom = top + 49
    d.rounded_rectangle((left, top, right, bottom), radius=4, outline=color, width=3)
    ax = left + 101
    d.line((ax, 352, ax, bottom + 9), fill=color, width=4)
    d.polygon([(ax, bottom + 2), (ax - 8, bottom + 15), (ax + 8, bottom + 15)], fill=color)
    d.text((x, 369), conclusion, font=body, fill='#17212b')
d.text((24, 410), 'Same prompt, same selected word, same window. Cropped from the original native captures.', font=small, fill='#53606c')
out.save(p / 'before-after.png')
