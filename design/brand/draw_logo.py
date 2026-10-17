"""6ixSummit Labs identity, authored through VectorCraft's command API.

Run with vectorcraft-draw/scripts/run.sh design/brand/draw_logo.py.
The compound path is the single source of truth for every exported mark.
"""

from pathlib import Path
import shutil
import sys
from zipfile import ZipFile, ZIP_DEFLATED
from vcscene import Scene

OUT = Path(__file__).resolve().parent
BLUE, INK, WHITE, MUTED = '#2563ff', '#08090a', '#f2f5f9', '#929ca9'
OUTER = [(74, 6), (48, 6), (10, 44), (10, 76), (30, 96),
         (72, 96), (94, 74), (94, 48), (74, 28), (52, 28)]
COUNTER = [(32, 74), (53, 46), (74, 74)]


def path_data(x=0, y=0, size=100):
    k = size / 100
    def subpath(points):
        return 'M' + ' L'.join(f'{x+a*k:g},{y+b*k:g}' for a, b in points) + ' Z'
    return subpath(OUTER) + ' ' + subpath(COUNTER)


def mark(s, x, y, size, color=BLUE):
    return s.path(d=path_data(x, y, size), fill=color, name='Ascent 6 — summit counter')


def text(s, value, x, y, size, color=WHITE, weight='Regular', tracking=0, font='Inter', justify='left'):
    oid = s.text(value, x=x, y=y, size=size, font=font, color=color, justify=justify)
    s.run('text.setStyle', ids=[oid], style=weight, tracking=tracking)
    return oid


def lockup(s, x, y, size, color=WHITE, mark_color=BLUE):
    # size is the height of the mark's 100-unit design grid.
    k = size / 100
    ids = [mark(s, x, y, size, mark_color)]
    ids.append(text(s, '6ixSummit', x+122*k, y+64*k, 54*k, color, 'Semi Bold', -35))
    ids.append(text(s, 'L A B S', x+124*k, y+91*k, 15*k, color, 'Medium', 100))
    return s.group(ids, '6ixSummit Labs — primary lockup')


def export(s, stem, extra_scales=()):
    s.run('select.none')
    result = s.run('document.export', path=str(OUT / f'{stem}.svg'), format='svg',
                   svg={'outlineText': True, 'preserveEditing': False,
                        'metadata': False, 'decimals': 3})
    if result.get('warnings'):
        print(result['warnings'])
    s.finish(str(OUT), stem, extra_scales=extra_scales)


def presentation():
    s = Scene(1600, 1120, name='6ixSummit Labs / Ascent 6 / Identity')
    s.shape('rectangle', x=0, y=0, width=1600, height=1120, fill=INK, name='Ink ground')
    text(s, '6IXSUMMIT LABS', 72, 62, 15, WHITE, 'Medium', 130)
    text(s, 'ASCENT 6  /  LOGO DESIGN', 1528, 62, 12, MUTED, font='JetBrains Mono', justify='right')
    s.path(points=[(72, 90), (1528, 90)], closed=False, stroke='#2b3038', strokeWidth=1)
    text(s, 'Built for the ascent.', 72, 156, 28, WHITE, 'Medium', -25)
    text(s, 'An idea. A clear route. A product in the world.', 72, 191, 16, MUTED)
    lockup(s, 366, 275, 220)
    text(s, 'A SIX IN SILHOUETTE. A SUMMIT IN THE NEGATIVE SPACE.',
         800, 583, 12, MUTED, font='JetBrains Mono', justify='center')
    s.shape('rectangle', x=0, y=660, width=1600, height=460, fill='#f1f0eb', name='Paper ground')
    s.path(points=[(560, 706), (560, 1050)], closed=False, stroke='#d3d4d1', strokeWidth=1)
    s.path(points=[(1050, 706), (1050, 1050)], closed=False, stroke='#d3d4d1', strokeWidth=1)
    text(s, '01 / PRIMARY', 72, 727, 12, '#5c6672', font='JetBrains Mono')
    lockup(s, 78, 808, 87, INK)
    text(s, 'Electric blue + ink', 72, 986, 17, INK, 'Medium')
    text(s, 'The everyday studio signature.', 72, 1016, 14, '#5c6672')
    text(s, '02 / STANDALONE', 604, 727, 12, '#5c6672', font='JetBrains Mono')
    s.shape('rectangle', x=610, y=778, width=160, height=160, radius=34, fill=BLUE, name='Social avatar')
    mark(s, 636, 802, 108, WHITE)
    mark(s, 824, 800, 116, INK)
    text(s, 'One colour. Full character.', 604, 986, 17, INK, 'Medium')
    text(s, 'App icons, profiles and print.', 604, 1016, 14, '#5c6672')
    text(s, '03 / SMALL SIZES', 1094, 727, 12, '#5c6672', font='JetBrains Mono')
    for x, size in [(1100, 16), (1160, 24), (1236, 32), (1332, 48), (1432, 64)]:
        mark(s, x, 874-size, size, INK)
        text(s, str(size), x, 915, 11, '#5c6672', font='JetBrains Mono')
    text(s, 'Recognisable at a glance.', 1094, 986, 17, INK, 'Medium')
    text(s, 'A solid shape with an open counter.', 1094, 1016, 14, '#5c6672')
    text(s, '6ixSummit Labs', 72, 1082, 12, '#5c6672')
    text(s, '#2563FF    /    #08090A    /    #F2F5F9', 1094, 1082, 11, '#5c6672', font='JetBrains Mono')
    s.run('document.export', path=str(OUT / '6ixsummit-logo-presentation.pdf'), format='pdf')
    export(s, '6ixsummit-logo-presentation', extra_scales=(2,))


def assets():
    for stem, foreground, mark_color in [
        ('6ixsummit-logo-dark', WHITE, BLUE),
        ('6ixsummit-logo-light', INK, BLUE),
        ('6ixsummit-logo-black', INK, INK),
        ('6ixsummit-logo-white', WHITE, WHITE),
    ]:
        s = Scene(760, 220, name=stem)
        lockup(s, 24, 20, 180, foreground, mark_color)
        export(s, stem, extra_scales=(2,))
    for stem, color in [('6ixsummit-mark-blue', BLUE), ('6ixsummit-mark-black', INK), ('6ixsummit-mark-white', WHITE)]:
        s = Scene(100, 100, name=stem)
        mark(s, 0, 0, 100, color)
        export(s, stem, extra_scales=(4,))
    s = Scene(512, 512, name='6ixSummit Labs — avatar')
    s.shape('rectangle', x=0, y=0, width=512, height=512, radius=104, fill=BLUE)
    mark(s, 80, 68, 352, WHITE)
    export(s, '6ixsummit-avatar')


def sync_web_assets():
    """Publish the approved mark and browser icons from the same source artwork."""
    root = OUT.parent.parent
    marks = root / 'src' / 'assets' / 'brand'
    marks.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT / '6ixsummit-mark-blue.svg', marks / '6ixsummit-mark-blue.svg')
    shutil.copyfile(OUT / '6ixsummit-avatar.svg', root / 'public' / 'favicon.svg')
    with Scene(512, 512, name='6ixSummit Labs — touch icon') as s:
        # Apple supplies the rounded mask for touch icons.
        s.shape('rectangle', x=0, y=0, width=512, height=512, fill=BLUE)
        mark(s, 80, 68, 352, WHITE)
        s.run('select.none')
        s.render(str(root / 'public' / 'apple-touch-icon.png'), scale=180/512)
    print('Synced website mark, favicon and 180px Apple touch icon')


def package_assets():
    with ZipFile(OUT.parent / '6ixsummit-logo-kit.zip', 'w', ZIP_DEFLATED) as archive:
        for asset in sorted(OUT.iterdir()):
            if asset.is_file():
                archive.write(asset, '6ixsummit-logo-kit/' + asset.name)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    presentation()
    assets()
    if '--sync-web' in sys.argv:
        sync_web_assets()
    package_assets()
