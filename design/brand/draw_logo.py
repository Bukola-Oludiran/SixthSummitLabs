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
COUNTER = [(26, 76), (43, 45), (54, 62), (65, 50), (81, 76)]


def path_data(x=0, y=0, size=100):
    k = size / 100
    def subpath(points):
        return 'M' + ' L'.join(f'{x+a*k:g},{y+b*k:g}' for a, b in points) + ' Z'
    return subpath(OUTER) + ' ' + subpath(COUNTER)


def mark(s, x, y, size, color=BLUE):
    return s.path(d=path_data(x, y, size), fill=color, name='Ascent 6 — twin summit counter')


def text(s, value, x, y, size, color=WHITE, weight='Regular', tracking=0, font='Inter', justify='left'):
    oid = s.text(value, x=x, y=y, size=size, font=font, color=color, justify=justify)
    s.run('text.setStyle', ids=[oid], style=weight, tracking=tracking)
    return oid


def lockup(s, x, y, scale=1, color=WHITE, mark_color=BLUE, labs_color=None):
    # The mark IS the initial 6, enlarged 25% from the cap-height treatment.
    # Keep its left edge and optical centre fixed, and shift the letters by the
    # additional silhouette width to preserve the gap before the i.
    k = scale
    mark_size = 82 * 1.25
    growth = mark_size - 82
    letter_shift = growth * 0.84
    ids = [mark(s, x-growth*0.10*k, y-growth*0.51*k, mark_size*k, mark_color)]
    ids.append(text(s, 'ixSummit', x+(78+letter_shift)*k, y+78*k, 100*k, color, 'Semi Bold', -35))
    ids.append(text(s, 'Labs', x+(534+letter_shift)*k, y+78*k, 64*k,
                    labs_color or color, 'Medium', -25))
    return s.group(ids, '6ixSummit Labs — integrated wordmark')


def export(s, stem, extra_scales=()):
    s.run('select.none')
    result = s.run('document.export', path=str(OUT / f'{stem}.svg'), format='svg',
                   svg={'outlineText': True, 'preserveEditing': False,
                        'metadata': False, 'decimals': 3})
    if result.get('warnings'):
        print(result['warnings'])
    s.finish(str(OUT), stem, extra_scales=extra_scales)


def presentation():
    s = Scene(1600, 1120, name='6ixSummit Labs / Twin Summit / Wordmark')
    s.shape('rectangle', x=0, y=0, width=1600, height=1120, fill=INK, name='Ink ground')
    text(s, '6IXSUMMIT LABS', 72, 62, 15, WHITE, 'Medium', 130)
    text(s, 'TWIN SUMMIT  /  WORDMARK', 1528, 62, 12, MUTED, font='JetBrains Mono', justify='right')
    s.path(points=[(72, 90), (1528, 90)], closed=False, stroke='#2b3038', strokeWidth=1)
    text(s, 'One name. One mark.', 72, 156, 28, WHITE, 'Medium', -25)
    text(s, 'The six becomes the signature. Two peaks carry the name.', 72, 191, 16, MUTED)
    lockup(s, 152, 315, 1.85, labs_color=MUTED)
    text(s, 'THE MARK REPLACES THE 6. THE SUMMIT BECOMES TWO PEAKS.',
         800, 583, 12, MUTED, font='JetBrains Mono', justify='center')
    s.shape('rectangle', x=0, y=660, width=1600, height=460, fill='#f1f0eb', name='Paper ground')
    s.path(points=[(560, 706), (560, 1050)], closed=False, stroke='#d3d4d1', strokeWidth=1)
    s.path(points=[(1050, 706), (1050, 1050)], closed=False, stroke='#d3d4d1', strokeWidth=1)
    text(s, '01 / PRIMARY', 72, 727, 12, '#5c6672', font='JetBrains Mono')
    lockup(s, 72, 830, 0.62, INK, labs_color='#5c6672')
    text(s, 'Electric blue + ink', 72, 986, 17, INK, 'Medium')
    text(s, 'A single, continuous brand name.', 72, 1016, 14, '#5c6672')
    text(s, '02 / STANDALONE', 604, 727, 12, '#5c6672', font='JetBrains Mono')
    s.shape('rectangle', x=610, y=778, width=160, height=160, radius=34, fill=BLUE, name='Social avatar')
    mark(s, 636, 802, 108, WHITE)
    mark(s, 824, 800, 116, INK)
    text(s, 'Two peaks. One silhouette.', 604, 986, 17, INK, 'Medium')
    text(s, 'A taller summit and a second ascent.', 604, 1016, 14, '#5c6672')
    text(s, '03 / SMALL SIZES', 1094, 727, 12, '#5c6672', font='JetBrains Mono')
    for x, size in [(1100, 16), (1160, 24), (1236, 32), (1332, 48), (1432, 64)]:
        mark(s, x, 874-size, size, INK)
        text(s, str(size), x, 915, 11, '#5c6672', font='JetBrains Mono')
    text(s, 'Recognisable at a glance.', 1094, 986, 17, INK, 'Medium')
    text(s, 'An open valley keeps both peaks clear.', 1094, 1016, 14, '#5c6672')
    text(s, '6ixSummit Labs', 72, 1082, 12, '#5c6672')
    text(s, '#2563FF    /    #08090A    /    #F2F5F9', 1094, 1082, 11, '#5c6672', font='JetBrains Mono')
    s.run('document.export', path=str(OUT / '6ixsummit-logo-presentation.pdf'), format='pdf')
    export(s, '6ixsummit-logo-presentation', extra_scales=(2,))


def assets():
    for stem, foreground, mark_color, labs_color in [
        ('6ixsummit-logo-dark', WHITE, BLUE, MUTED),
        ('6ixsummit-logo-light', INK, BLUE, '#5c6672'),
        ('6ixsummit-logo-black', INK, INK, INK),
        ('6ixsummit-logo-white', WHITE, WHITE, WHITE),
    ]:
        s = Scene(700, 100, name=stem)
        lockup(s, 0, 8, 1, foreground, mark_color, labs_color)
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
    shutil.copyfile(OUT / '6ixsummit-logo-dark.svg', marks / '6ixsummit-logo-dark.svg')
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
