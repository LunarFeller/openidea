from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math, os
r=Path(os.environ.get('OPENIDEA_EVIDENCE_DIR', '/tmp/openidea-agent-project-verification'))
font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(size): return ImageFont.truetype(font_path,size)
red='#c6333a';green='#137547';ink='#17212c';muted='#536071';bg='#f2f4f7'
width=1000;gap=24;pad=24;head=150
panels=[]
for phase,color,title,detail in [
 ('before',red,"Before: B jumps to A's old task",'The old reply inserts old-a into B and opens it.'),
 ('after',green,"After: B keeps its current draft",'The old reply cannot change B or open a task.')]:
    im=Image.open(r/f'{phase}-3-old-reply-completed.png').convert('RGB')
    state=json.loads((r/f'{phase}-3-old-reply-completed.json').read_text())
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((165,7,385,77),radius=8,outline=color,width=5)
    rect=state['tabRect'];tab=(rect['x']*2-6,rect['y']*2-5,(rect['x']+rect['width'])*2+6,(rect['y']+rect['height'])*2+5)
    d.rounded_rectangle(tab,radius=8,outline=color,width=5)
    cr=state['composerRect'];y=cr['y']*2
    composer=(cr['x']*2-8,y-8,(cr['x']+cr['width'])*2+8,y+cr['height']*2+10)
    d.rounded_rectangle(composer,radius=8,outline=color,width=5)
    panel=Image.new('RGB',(width,620),'white');p=ImageDraw.Draw(panel)
    p.text((24,18),title,font=font(31),fill=color)
    p.text((24,65),detail,font=font(22),fill=ink)
    top=im.crop((105,0,1510,177));top.thumbnail((950,160),Image.Resampling.LANCZOS)
    panel.paste(top,(24,108))
    p.text((24,254),'Visible composer after the old reply:',font=font(24),fill=ink)
    crop=im.crop((cr['x']*2-25,y-25,(cr['x']+cr['width'])*2+25,y+150))
    crop.thumbnail((950,190),Image.Resampling.LANCZOS);panel.paste(crop,(24,300))
    # Arrow points at the existing composer content; only annotations alter the image.
    p.line((145,446,250,326),fill=color,width=5)
    p.polygon([(250,326),(231,336),(245,348)],fill=color)
    p.text((24,465),'B task IDs: '+', '.join(state['taskIds']),font=font(25),fill=ink)
    p.text((24,511),'Active: '+state['active']['key'],font=font(24),fill=ink)
    p.text((24,560),'Native macOS screenshots; details cropped for readability.',font=font(18),fill=muted)
    panels.append(panel)
result=Image.new('RGB',(2*width+gap+2*pad,head+620+pad),bg);d=ImageDraw.Draw(result)
d.text((pad,20),'Create in A -> switch to B -> A replies late',font=font(39),fill=ink)
d.text((pad,82),'Fixed: an old connection cannot change the current project or steal its active page.',font=font(27),fill=ink)
for n,p in enumerate(panels):result.paste(p,(pad+n*(width+gap),head))
result.save(r/'native-comparison.png',optimize=True)
# A numbered capture sequence, clearly labelled as screenshots rather than a continuous recording.
frames=[]
for phase,color in [('before',red),('after',green)]:
    for step,name,caption in [(1,'requested-in-a','1. Start a task in project A; hold its reply.'),(2,'current-project-b','2. Switch to project B and type its current draft.'),(3,'old-reply-completed',"3. Release A's reply: "+('B jumps to the old task.' if phase=='before' else 'B stays on its current draft.'))]:
        im=Image.open(r/f'{phase}-{step}-{name}.png').convert('RGB');im.thumbnail((1152,708),Image.Resampling.LANCZOS)
        frame=Image.new('RGB',(1152,800),'white');d=ImageDraw.Draw(frame)
        d.text((16,12),phase.upper()+'  |  '+caption,font=font(25),fill=color)
        d.text((16,50),'Native screenshot sequence with controlled Agent acknowledgements.',font=font(18),fill=muted)
        frame.paste(im,(0,92));frames.append(frame)
frames[0].save(r/'native-sequence.gif',save_all=True,append_images=frames[1:],duration=[1800,1800,3000]*2,loop=0,optimize=True)
print(r/'native-comparison.png')
print(r/'native-sequence.gif')
