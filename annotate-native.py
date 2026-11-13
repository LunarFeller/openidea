from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont
import hashlib, json

ROOT = Path(__file__).parent
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 17)
notes = {
    'aggregates': {
        'before': ['BEFORE: 9007199254740993 + 1 is displayed as 9007199254740992. Expected: 9007199254740994.', 'Avg and Median should both be 4503599627370497; the displayed values are also rounded.'],
        'after': ['AFTER: Sum is 9007199254740994. Avg and Median are both 4503599627370497.', 'The selected database values are identical to the BEFORE screenshot.'],
    },
    'decimals': {
        'before': ['BEFORE: 1.0000000000000000002 + 2.0000000000000000004 is incorrectly displayed as 3.', 'Expected Sum: 3.0000000000000000006. Expected Avg and Median: 1.5000000000000000003.'],
        'after': ['AFTER: Sum is 3.0000000000000000006. Avg and Median are 1.5000000000000000003.', 'SQLite TEXT stores the exact decimal fixture; the real query values reach the statistics panel unchanged.'],
    },
    'http': {
        'before': ['BEFORE: id 9007199254740993 becomes 9007199254740992; amount 1.0000000000000000002 becomes 1.', 'The response contains tiny: 1e-400, but the formatted view shows 0. The raw response retains all digits.'],
        'after': ['AFTER: id 9007199254740993, amount 1.0000000000000000002 and tiny 1e-400 are preserved.', 'The local server sends the same response body as in the BEFORE screenshot.'],
    },
}
records = []
for name, phases in notes.items():
    for phase, lines in phases.items():
        source = ROOT / f'native-{phase}-{name}.png'
        if not source.exists():
            continue
        report = json.loads((ROOT / f'native-{phase}-{name}.json').read_text())['data']
        if name == 'decimals':
            report = report['ui']
        original = Image.open(source)
        sx, sy = original.width / report['viewport']['width'], original.height / report['viewport']['height']
        if name == 'http':
            b = report['bounds']
            bounds = (b['x'] + 2, b['y'] + 2, b['x'] + min(360, b['width'] - 2), b['y'] + b['height'] - 2)
        else:
            boxes = [r['bounds'] for r in report['rowBounds'] if r['label'] in ('Sum', 'Avg', 'Median')]
            bounds = (min(b['x'] for b in boxes)-2, min(b['y'] for b in boxes)-2,
                      max(b['x']+b['width'] for b in boxes)+2, max(b['y']+b['height'] for b in boxes)+2)
        rect = tuple(round(n * (sx if i % 2 == 0 else sy)) for i, n in enumerate(bounds))
        canvas = Image.new(original.mode, (original.width, original.height + 88), '#15171a')
        canvas.paste(original, (0, 0))
        draw = ImageDraw.Draw(canvas)
        color = '#bc3038' if phase == 'before' else '#168047'
        draw.rectangle(rect, outline=color, width=3)
        for i, line in enumerate(lines):
            assert draw.textbbox((0, 0), line, font=font)[2] < original.width - 40
            draw.text((20, original.height + 15 + i * 29), line, font=font, fill='#f1f3f5')
        dest = ROOT / f'native-{phase}-{name}-annotated.png'
        canvas.save(dest, icc_profile=original.info.get('icc_profile'))
        modified = Image.open(dest).crop((0, 0, original.width, original.height))
        inner = (rect[0]+4, rect[1]+4, rect[2]-4, rect[3]-4)
        assert ImageChops.difference(original.crop(inner), modified.crop(inner)).getbbox() is None
        diff = ImageChops.difference(original.convert('RGB'), modified.convert('RGB')).getbbox()
        assert diff and diff[0]>=rect[0] and diff[1]>=rect[1] and diff[2]<=rect[2]+1 and diff[3]<=rect[3]+1
        records.append({'source':source.name,'annotated':dest.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frame':rect,'changed_original_pixels_bbox':diff,'original_digits_unchanged':True,'method':'Pillow outline and footer; original screenshot pixels preserved inside the frame and everywhere outside it'})
(ROOT / 'native-annotations.json').write_text(json.dumps(records, indent=2)+'\n')
print(json.dumps({'annotated_images':len(records),'all_original_digit_pixels_unchanged':all(r['original_digits_unchanged'] for r in records)}))
