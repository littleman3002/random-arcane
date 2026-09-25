# Packs the Grok-generated creature material textures (assets/creature_tex/*.png) into one atlas for the game.
# Each texture is flattened (large-scale shading removed) so it tiles without visible bands. Output: src/creature_atlas.b64
# python3 assets/make_atlas.py   (needs Pillow)
import base64, io, json, pathlib
from PIL import Image, ImageFilter, ImageChops, ImageStat
R = pathlib.Path(__file__).parent; SRC = R / 'creature_tex'
NAMES = ['chitin_plum', 'flesh_pink', 'carapace_void', 'legs_black', 'fur_tiger', 'fur_dark', 'bone', 'shell_hex', 'scales_reptile', 'skin_troll', 'moss',
         'leather_rag', 'bark', 'iron', 'steel_filigree', 'cloth_blue', 'cloth_red', 'pumpkin', 'leaf', 'stone_block', 'fluff_white', 'wing_moth']
N, A = 5, 2048; C = A // N
atlas = Image.new('RGB', (A, A), (128, 128, 128))
for k, n in enumerate(NAMES):
    im = Image.open(SRC / f'{n}.png').convert('RGB').resize((C, C), Image.LANCZOS)
    low = im.filter(ImageFilter.GaussianBlur(C / 5)); mean = ImageStat.Stat(im).mean
    flat = Image.merge('RGB', [Image.eval(ImageChops.subtract(im.getchannel(i), low.getchannel(i), 1, int(mean[i])), lambda v: v) for i in range(3)])
    atlas.paste(flat, ((k % N) * C, (k // N) * C))
buf = io.BytesIO(); atlas.save(buf, 'JPEG', quality=84)
(R.parent / 'src/creature_atlas.b64').write_text(base64.b64encode(buf.getvalue()).decode())
print('atlas', A, 'cells', N, 'bytes', len(buf.getvalue()), json.dumps({n: k for k, n in enumerate(NAMES)}))
