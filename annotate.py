from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/tmp/openidea-agent-draft-ack-20261114')
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
REGULAR = ImageFont.truetype(FONT, 23)
SMALL = ImageFont.truetype(FONT, 18)
TITLE = ImageFont.truetype(FONT, 29)
WIDTH = 1100
PAD = 24
COLORS = {'before': '#b32628', 'after': '#116b41'}

def crop(phase, step):
    image = Image.open(ROOT / f'{phase}-{step}.png').convert('RGB')
    info = json.loads((ROOT / f'{phase}-completed.json').read_text())
    sx, sy = image.width / info['innerWidth'], image.height / info['innerHeight']
    r = info['rect']
    area = (int((r['x']-24)*sx), int((r['y']-44)*sy), int((r['x']+r['width']+24)*sx), int((r['y']+92)*sy))
    patch = image.crop(area)
    draw = ImageDraw.Draw(patch)
    box = ((r['x']-3)*sx-area[0], (r['y']-3)*sy-area[1], (r['x']+r['width']+3)*sx-area[0], (r['y']+r['height']+3)*sy-area[1])
    draw.rounded_rectangle(box, radius=5, outline=COLORS[phase], width=5)
    height = round(patch.height * (WIDTH-2*PAD) / patch.width)
    return patch.resize((WIDTH-2*PAD,height), Image.Resampling.LANCZOS)

def comparison(step, title, before_label, after_label):
    patches = [crop(phase, step) for phase in ['before','after']]
    canvas = Image.new('RGB',(WIDTH,148 + sum(p.height for p in patches) + 112),'#f2f4f7')
    draw = ImageDraw.Draw(canvas)
    draw.text((PAD,18),title,font=TITLE,fill='#18232e')
    draw.text((PAD,60),'Send A, type B while waiting, then acknowledge A.',font=REGULAR,fill='#394756')
    y=110
    for phase,label,patch in zip(['before','after'],[before_label,after_label],patches):
        draw.text((PAD,y),label,font=REGULAR,fill=COLORS[phase])
        y+=36
        canvas.paste(patch,(PAD,y))
        y+=patch.height+22
    draw.text((PAD,y+2),'macOS Tauri / WebKit - real editor with controlled local acknowledgements',font=SMALL,fill='#394756')
    return canvas.crop((0,0,WIDTH,y+42))

final = comparison('3-completed','Keep the next draft when the previous send completes',
    'Before: acknowledgement of A deletes the unsent B.',
    'After: acknowledgement of A keeps the unsent B.')
final.save(ROOT/'native-comparison.png')
frames = [
    comparison('1-submitted','1. The user prepares message A','Before: A is ready to send.','After: A is ready to send.'),
    comparison('2-pending','2. A is pending; the user has typed B','Before: B is visible while waiting.','After: B is visible while waiting.'),
    comparison('3-completed','3. A is acknowledged; compare the next draft',
        'Before: acknowledgement of A deletes the unsent B.',
        'After: acknowledgement of A keeps the unsent B.'),
]
frames[0].save(ROOT/'native-steps.gif',save_all=True,append_images=frames[1:],duration=[1800,2400,3600],loop=0,optimize=True)
print(ROOT/'native-comparison.png')
print(ROOT/'native-steps.gif')
