"""Editable proposed logo, only used after research finds no existing logo."""
import json
import sys
from pathlib import Path
from vcscene import Scene

brief = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
colours = brief.get('requiredPalette') or ['#174b3a', '#e4b075', '#f8f4e8']
ink = colours[0]
name = brief['businessName']
initials = ''.join(word[0] for word in name.split()[:2]).upper()
motifs = ' '.join(str(item.get('description', '') if isinstance(item, dict) else item) for item in brief.get('motifs', [])).lower()
botanical = any(word in motifs for word in ['flower', 'petal', 'bloom', 'botanical'])
s = Scene(1000, 250, name=f'{name} / proposed identity')
if botanical:
    import math
    for i in range(6):
        angle = i * math.pi / 3
        s.shape('ellipse', x=105+48*math.cos(angle)-27, y=120+48*math.sin(angle)-27,
                width=54, height=54, fill=ink, name='Petal')
    s.shape('ellipse', x=87, y=102, width=36, height=36, fill=colours[-1], name='Flower centre')
else:
    s.shape('ellipse', x=25, y=35, width=170, height=170, fill=ink, name='Monogram seal')
    s.text(initials, x=110, y=147, size=62, font='Helvetica', color='#ffffff', justify='center')
# Restrained type keeps the complete business name readable; no invented tagline.
size = min(66, 1130 / max(len(name), 1))
oid = s.text(name, x=230, y=140, size=size, font='Helvetica', color=ink)
s.run('text.setStyle', ids=[oid], style='Regular', tracking=-10)
s.run('select.none')
s.run('document.export', path=str(out / 'logo.svg'), format='svg',
      svg={'outlineText': True, 'preserveEditing': False, 'metadata': False, 'decimals': 3})
s.finish(str(out), 'logo', extra_scales=(2,))
