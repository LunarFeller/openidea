from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
p = Path(__file__).resolve().parent
font = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(font, 31)
body = ImageFont.truetype(font, 24)
small = ImageFont.truetype(font, 21)
# A crop of the native capture around the Database header and connection icon.
crop = (2180, 70, 2810, 278)

def card(file, heading, lines, color):
    raw = Image.open(p / file).convert('RGB')
    im = Image.new('RGB', (690, 390), '#f4f5f7')
    draw = ImageDraw.Draw(im)
    draw.text((26, 15), heading, font=title, fill='#17212b')
    im.paste(raw.crop(crop), (30, 65))
    draw.rectangle((97, 219, 491, 263), outline=color, width=4)
    draw.line((110, 310, 110, 273), fill=color, width=5)
    draw.polygon([(110, 263), (101, 278), (119, 278)], fill=color)
    for i, line in enumerate(lines):
        draw.text((132, 294 + i * 31), line, font=body, fill='#17212b')
    draw.text((30, 365), 'Native macOS app · real SQLite response delayed', font=small, fill='#596573')
    return im

before = card('before-3-stale.png', 'Before: the connection dot comes back', ['The user already deactivated it.', 'The late reply wrongly marks it connected.'], '#c02d3c')
after = card('after-3-disconnected.png', 'After: it stays disconnected', ['The late reply is ignored.', 'The backend connection stays closed.'], '#17815a')
before.save(p / 'before-annotated.png')
after.save(p / 'after-annotated.png')
comparison = Image.new('RGB', (1398, 390), '#dce1e6')
comparison.paste(before, (0, 0)); comparison.paste(after, (708, 0))
comparison.save(p / 'before-after.png')
for phase, files in [('before', ['before-1-pending.png', 'before-2-disconnected.png', 'before-3-stale.png']), ('after', ['after-1-pending.png', 'after-2-disconnected.png', 'after-3-disconnected.png'])]:
    captions = [
        ['1. A real metadata reply is held.', 'The connection is initially active.'],
        ['2. The user clicks Deactivate.', 'The connection dot disappears.'],
        ['3. The old reply arrives.', 'BUG: connected again.' if phase == 'before' else 'It stays disconnected.'],
    ]
    frames = [card(file, ('Before fix' if phase == 'before' else 'After fix'), lines, '#c02d3c' if phase == 'before' else '#17815a') for file, lines in zip(files, captions)]
    frames[0].save(p / (phase + '-sequence.gif'), save_all=True, append_images=frames[1:], duration=[2200, 2200, 4000], loop=0)
print('Created annotated native captures and sequences using Pillow.')
