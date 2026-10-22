"""Offline schematic only; no Unreal viewport or source assets are touched."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).parents[3]/'Saved'/'CaveNetworkRebuild'
g=json.loads((ROOT/'CONNECTED_ROUTE_GEOMETRY_V4.json').read_text())
r=json.loads((ROOT/'RAIL_NETWORK_V5.json').read_text())
f=json.loads((ROOT/'FISSURE_NETWORK_V5.json').read_text())
im=Image.new('RGB',(2100,1720),'#101a23');d=ImageDraw.Draw(im)
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
bold=lambda n:ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',n)
white='#edf3f2';mute='#acbcc6';amber='#efbd68';cyan='#83ddd3';gray='#596e7c'
d.text((70,35),'MINE V5  /  TRANSPORT & HIDDEN PASSAGES',fill=white,font=bold(43))
d.text((73,97),'Architecture overview  •  Schematic, not a gameplay screenshot',fill=mute,font=font(24))
allp=[s[k] for s in g['segments'] for k in ('a','b')]
xmin=min(p[0] for p in allp)-9000;xmax=max(p[0] for p in allp)+7000
ymin=min(p[1] for p in allp)-10000;ymax=max(p[1] for p in allp)+12000
scale=min(1430/(xmax-xmin),1130/(ymax-ymin))
def xy(p):return (70+(p[0]-xmin)*scale,165+(ymax-p[1])*scale)
for cave in g['giant_caverns']:
 x,y=xy(cave['center']);rr=cave['radius']*scale
 d.ellipse((x-rr,y-rr,x+rr,y+rr),fill='#173b4e' if cave['water'] else '#293141',outline='#718d9a',width=2)
 d.text((x-rr,y+rr+7),cave['name'],fill=mute,font=font(19))
for s in g['segments']:d.line([xy(s['a']),xy(s['b'])],fill=gray,width=4 if s['kind']=='ramp' else 3)
# At mine-wide scale, two rails would occupy a fraction of a pixel. Show their
# shared service corridor once and explain the real separation in the inset.
out=[xy(s['position_cm']) for s in r['samples'] if s['section']=='outgoing']
d.line(out,fill=amber,width=5)
for rr in f['routes']:
 pts=[xy(p) for p in rr['route_floor_points']]
 d.line(pts,fill=cyan,width=3)
 for mouth in rr['mouths']:
  x,y=xy(mouth['center']);d.ellipse((x-4,y-4,x+4,y+4),fill=cyan)
for i,region in enumerate(g['districts']):
 x,y=xy(region['center']);label=region['name']
 d.text((x-105,y-27),str(i+1)+'  '+label,fill=white,font=bold(23))
 d.text((x-100,y+3),f"{region['center'][2]/100:.1f} m datum",fill=mute,font=font(19))
for st in r['stations']:
 x,y=xy(st['outgoing_cart_stop_cm']);rr=7 if st['id'] in ('depot','deep_terminus') else 5
 d.ellipse((x-rr,y-rr,x+rr,y+rr),fill='#101a23',outline=amber,width=3)
entry=xy(g['segments'][231]['a']);d.ellipse((entry[0]-7,entry[1]-7,entry[0]+7,entry[1]+7),fill=white)
d.text((entry[0]-105,entry[1]+17),'PLAYER ENTRANCE',fill=white,font=font(18))

panel=1550;d.line((1515,165,1515,1310),fill='#334651',width=2)
d.text((panel,175),'CONNECTED SYSTEMS',fill=white,font=bold(26))
d.line((panel,238,panel+65,238),fill=gray,width=4);d.text((panel+82,220),'Main mine passages',fill=mute,font=font(23))
d.line((panel,293,panel+65,293),fill=amber,width=5);d.text((panel+82,275),'Dual railway corridor',fill=white,font=font(23))
d.line((panel,348,panel+65,348),fill=cyan,width=3);d.text((panel+82,330),'Creature fissure routes',fill=mute,font=font(23))
d.text((panel,404),'13.53 km',fill=white,font=bold(46));d.text((panel,462),'Primary mine route network',fill=mute,font=font(22))
d.text((panel,526),f"{r['circuit_length_km']:.2f} km",fill=amber,font=bold(46));d.text((panel,584),'Closed cart circuit, both directions',fill=mute,font=font(21))
d.text((panel,648),'7 stations / 12 stops',fill=white,font=bold(28))
d.text((panel,693),'Five district pairs + two termini',fill=mute,font=font(20))
d.text((panel,754),'12 fissure routes',fill=cyan,font=bold(29))
d.text((panel,796),'24 mouths, about 1.58 km',fill=mute,font=font(22))
d.text((panel,870),'LEVEL DESIGN INTENT',fill=white,font=bold(23))
for j,line in enumerate(['Four descents connect the districts.','Two broad terminal turning loops.','Flooded passage stays rail-free.','Fissures stay inside encounter groups.','No creature climbing/swimming assumed.']):
 d.text((panel,912+j*37),line,fill=mute,font=font(20))
d.text((panel,1165),'Cart gameplay: six runtime checks passed.',fill=white,font=font(20))
d.text((panel,1203),'Creature traversal: assets unavailable;',fill=mute,font=font(20))
d.text((panel,1233),'not implemented or runtime tested.',fill=mute,font=font(20))

d.line((65,1325,2035,1325),fill='#334651',width=2)
d.text((70,1353),'DUAL-TRACK CROSS SECTION  /  TYPICAL 6 m FLOOR',fill=white,font=bold(26))
d.text((70,1395),'Real track spacing shown here; schematic does not show every prop or collision surface.',fill=mute,font=font(21))
left=90;top=1460;factor=2.25
d.rectangle((left,top,left+600*factor,top+90),fill='#354148',outline='#72848b',width=2)
for center in (190,410):
 x0=left+(center-97.64)*factor;x1=left+(center+97.64)*factor
 d.rectangle((x0,top+15,x1,top+72),fill='#735d41',outline=amber,width=2)
 for rail in (center-42.25,center+42.25):d.line((left+rail*factor,top+12,left+rail*factor,top+78),fill='#c5cbd0',width=5)
d.text((left+100,top+100),'92 cm outer shoulder',fill=mute,font=font(20))
d.text((left+495,top+100),'220 cm between track centers',fill=amber,font=font(21))
d.text((left+1045,top+100),'92 cm outer shoulder',fill=mute,font=font(20))
d.text((1548,1437),'Nominal footprint only.',fill=white,font=bold(23))
d.text((1548,1480),'Player capsule: 70 cm diameter.',fill=mute,font=font(21))
d.text((1548,1514),f"Maximum local raised bed: {r['height_audit']['max_railbed_lift_cm']:.0f} cm.",fill=mute,font=font(21))
d.text((1548,1548),'94 central walking-deck spans cover',fill=mute,font=font(21))
d.text((1548,1582),'raised gaps between the track beds.',fill=mute,font=font(21))
d.text((70,1660),f"Current saved V4 elevations retained. Route lengths describe different networks; the {r['circuit_length_km']:.2f} km circuit includes outgoing and return tracks.",fill=mute,font=font(20))
im.save(ROOT/'V5_RAIL_FISSURE_OVERVIEW.png')
print(ROOT/'V5_RAIL_FISSURE_OVERVIEW.png')
