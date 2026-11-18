from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
root=Path(__file__).parents[3]/'Saved'/'CaveNetworkRebuild';d=json.loads((root/'CONNECTED_ROUTE_GEOMETRY_V4.json').read_text())
im=Image.new('RGB',(1800,1500),'#111b24');dr=ImageDraw.Draw(im)
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
colors=['#e7b66b','#d28c66','#80c8c0','#a699d6','#5ba6d7']
dr.text((65,35),'MINE EXPANSION · V4',(240,240,235),font=font(48));dr.text((68,103),'Route plan — not an Unreal screenshot',(166,184,196),font=font(23))
allp=[s[e] for s in d['segments'] for e in ['a','b']];xmin=min(p[0] for p in allp)-8000;xmax=max(p[0] for p in allp)+8000;ymin=min(p[1] for p in allp)-10000;ymax=max(p[1] for p in allp)+10000
scale=min(1580/(xmax-xmin),1010/(ymax-ymin))
def xy(p):return (100+(p[0]-xmin)*scale,180+(ymax-p[1])*scale)
for s in d['segments']:
 dr.line([xy(s['a']),xy(s['b'])],fill='#edf3f3' if s['kind']=='ramp' else colors[s['level']],width=5 if s['kind']=='ramp' else 4)
for g in d['giant_caverns']:
 x,y=xy(g['center']);r=g['radius']*scale;dr.ellipse((x-r,y-r,x+r,y+r),fill='#214253' if g['water'] else '#35364b',outline='#c5e8e8',width=3);dr.text((x-r,y+r+6),g['name'],fill='#e7eeee',font=font(22))
for i,region in enumerate(d['districts']):
 x,y=xy(region['center']);dr.text((x-100,y-20),str(i+1)+' · '+region['name'],fill=colors[i],font=font(24));dr.text((x-90,y+14),f"{region['center'][2]/100:.1f} m datum",fill='#bdc9d0',font=font(19))
p=xy(d['segments'][231]['a']);dr.ellipse((p[0]-8,p[1]-8,p[0]+8,p[1]+8),fill='white');dr.text((p[0]-80,p[1]+14),'PLAYER ENTRY',fill='white',font=font(20))
dr.line((65,1270,1730,1270),fill='#384855',width=2)
dr.text((65,1300),f"{d['length_km']:.2f} km / {d['length_miles']:.2f} miles  ·  5 offset districts  ·  4 connecting descents",fill='#edf0f0',font=font(29))
dr.text((65,1350),'3 new vast caverns  ·  2 new lakes  ·  Preserved flooded swim-through',fill='#bcd0da',font=font(26))
dr.text((65,1410),f"Geometry check: connected graph · maximum grade {d['max_grade_degrees']:.2f}° · see traversal report",fill='#a6b6c1',font=font(22))
im.save(root/'V4_LAYOUT_PLAN.png')
print(root/'V4_LAYOUT_PLAN.png')
