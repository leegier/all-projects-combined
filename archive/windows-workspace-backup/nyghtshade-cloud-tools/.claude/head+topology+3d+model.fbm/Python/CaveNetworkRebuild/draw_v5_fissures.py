"""Offline design overview. The image is a plan, not an Unreal screenshot."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

saved = Path(__file__).parents[3] / 'Saved' / 'CaveNetworkRebuild'
data = json.loads((saved / 'CONNECTED_ROUTE_GEOMETRY_V4.json').read_text())
fissures = json.loads((saved / 'FISSURE_NETWORK_V5.json').read_text())
image = Image.new('RGB', (1900, 1600), '#101923')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)
small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 18)
title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 36)
bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 25)
points = [n['position'] for n in data['nodes']]
xmin = min(p[0] for p in points) - 14000
xmax = max(p[0] for p in points) + 16000
ymin = min(p[1] for p in points) - 13000
ymax = max(p[1] for p in points) + 14000
scale = min(1750 / (xmax - xmin), 1250 / (ymax - ymin))


def xy(p):
    return (85 + (p[0] - xmin) * scale, 145 + (ymax - p[1]) * scale)


colors = ['#A88F62', '#57A5B9', '#B693DB', '#D48268', '#6BA582']
profile_colors = {'narrow_bend':'#FFE288', 'vertical_split':'#FBB8CE', 'low_gap':'#A9EDBF'}
draw.text((70, 38), 'MINE V5  /  SECONDARY FISSURE RESERVATIONS', font=title, fill='#F1ECE0')
draw.text((72, 91), 'Architectural plan | 12 separate encounter groups | 24 paired mouths | 1.58 km reserved', font=font, fill='#B6C2CC')
for edge in data['segments']:
    draw.line([xy(edge['a']), xy(edge['b'])], fill=colors[edge['level']], width=3)
for route in fissures['routes']:
    path = [xy(q) for q in route['route_floor_points']]
    draw.line(path, fill=profile_colors[route['profile']['name']], width=5)
    for mouth in route['mouths']:
        x, y = xy(mouth['center'])
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill='#FFF4D6')
    x, y = path[len(path) // 2]
    draw.text((x + 6, y - 20), route['id'], font=small, fill='#FFF4D6')
for i, district in enumerate(data['districts']):
    x, y = xy(district['center'])
    draw.text((x - 105, y - 16), district['name'], font=bold, fill=colors[i])
    draw.text((x - 80, y + 20), 'Datum %.1f m' % (district['center'][2] / 100), font=small, fill='#AEBCC5')
draw.line((70, 1452, 1830, 1452), fill='#344450', width=2)
draw.text((70, 1480), 'Gold: 6 narrow bends 60x110cm | Pink: 3 vertical splits 46x165cm | Green: 3 low gaps 64x72cm', font=font, fill='#D5DFE4')
draw.text((70, 1520), 'Architectural design only | Creature assets absent | AI traversal not implemented or runtime-tested', font=font, fill='#FFC895')
image.save(saved / 'FISSURE_NETWORK_V5_PLAN.png')
print(saved / 'FISSURE_NETWORK_V5_PLAN.png')
