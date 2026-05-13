#!/usr/bin/env python3
"""Gera todos os assets de imagem do VouCom (ícone + splash)."""
from PIL import Image, ImageDraw, ImageFilter
import math, os

BG     = (13, 15, 20)       # #0d0f14
BLUE   = (74, 158, 255)     # #4a9eff
WHITE  = (255, 255, 255)
CLEAR  = (0, 0, 0, 0)

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')

# ── primitivas ──────────────────────────────────────────────────────────────

def thick_line(draw, p1, p2, w, color):
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length == 0:
        return
    nx = -dy / length * w / 2
    ny =  dx / length * w / 2
    draw.polygon([
        (x1 + nx, y1 + ny), (x2 + nx, y2 + ny),
        (x2 - nx, y2 - ny), (x1 - nx, y1 - ny),
    ], fill=color)
    draw.ellipse([x1-w/2, y1-w/2, x1+w/2, y1+w/2], fill=color)
    draw.ellipse([x2-w/2, y2-w/2, x2+w/2, y2+w/2], fill=color)

def dot(draw, cx, cy, r_outer, r_inner, color_outer, color_inner):
    draw.ellipse([cx-r_outer, cy-r_outer, cx+r_outer, cy+r_outer], fill=color_outer)
    draw.ellipse([cx-r_inner, cy-r_inner, cx+r_inner, cy+r_inner], fill=color_inner)

def draw_symbol(size):
    """
    Desenha o símbolo do VouCom (V estilizado) em RGBA transparente.
    Retorna Image RGBA no tamanho (size, size).
    Usa supersampling 4x para antialiasing suave.
    """
    S = size * 4
    layer = Image.new('RGBA', (S, S), CLEAR)
    draw  = ImageDraw.Draw(layer)

    cx = S // 2
    cy = S // 2

    # Proporções
    arm_x   = int(S * 0.255)   # distância horizontal de cada braço ao centro
    top_y   = cy - int(S * 0.265)
    bot_y   = cy + int(S * 0.265)
    line_w  = int(S * 0.088)
    dot_r   = int(line_w * 0.68)
    inner_r = int(dot_r  * 0.42)

    left_pt  = (cx - arm_x, top_y)
    right_pt = (cx + arm_x, top_y)
    bot_pt   = (cx, bot_y)

    # Glow (camada borrada por baixo)
    glow = Image.new('RGBA', (S, S), CLEAR)
    gd   = ImageDraw.Draw(glow)
    thick_line(gd, left_pt,  bot_pt, int(line_w * 1.8), BLUE + (90,))
    thick_line(gd, right_pt, bot_pt, int(line_w * 1.8), BLUE + (90,))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(S * 0.012)))
    layer = Image.alpha_composite(layer, glow)
    draw  = ImageDraw.Draw(layer)

    # Braços do V
    thick_line(draw, left_pt,  bot_pt, line_w, BLUE  + (255,))
    thick_line(draw, right_pt, bot_pt, line_w, BLUE  + (255,))

    # Pontos de parada (waypoints)
    dot(draw, *left_pt,  dot_r,          inner_r,          WHITE + (255,), BLUE + (255,))
    dot(draw, *right_pt, dot_r,          inner_r,          WHITE + (255,), BLUE + (255,))
    dot(draw, *bot_pt,   int(dot_r*1.2), int(inner_r*1.2), WHITE + (255,), BLUE + (255,))

    return layer.resize((size, size), Image.LANCZOS)

# ── geradores ────────────────────────────────────────────────────────────────

def icon_png(size=1024):
    """Ícone completo: fundo escuro + símbolo."""
    img  = Image.new('RGBA', (size, size), BG + (255,))
    sym  = draw_symbol(size)
    img  = Image.alpha_composite(img, sym)
    return img.convert('RGB')   # iOS exige sem canal alpha

def foreground_png(size=1024):
    """Android adaptive — só o símbolo, fundo transparente."""
    # Símbolo ocupa ~62% do ícone; centralizado na safe zone
    sym_size = int(size * 0.62)
    sym  = draw_symbol(sym_size)
    img  = Image.new('RGBA', (size, size), CLEAR)
    off  = (size - sym_size) // 2
    img.paste(sym, (off, off), sym)
    return img

def background_png(size=1024):
    return Image.new('RGB', (size, size), BG)

def monochrome_png(size=1024):
    """Android monochrome — símbolo branco, fundo transparente."""
    S = size * 4
    layer = Image.new('RGBA', (S, S), CLEAR)
    draw  = ImageDraw.Draw(layer)

    cx    = S // 2
    cy    = S // 2
    arm_x = int(S * 0.255)
    top_y = cy - int(S * 0.265)
    bot_y = cy + int(S * 0.265)
    lw    = int(S * 0.088)

    thick_line(draw, (cx - arm_x, top_y), (cx, bot_y), lw, WHITE + (255,))
    thick_line(draw, (cx + arm_x, top_y), (cx, bot_y), lw, WHITE + (255,))

    dr = int(lw * 0.68)
    for px, py in [(cx - arm_x, top_y), (cx + arm_x, top_y), (cx, bot_y)]:
        draw.ellipse([px-dr, py-dr, px+dr, py+dr], fill=WHITE + (255,))

    return layer.resize((size, size), Image.LANCZOS)

def splash_png(size=800):
    """Splash: fundo transparente + símbolo centralizado (fundo vem do app.json)."""
    img = Image.new('RGBA', (size, size), CLEAR)
    sym = draw_symbol(size)
    return Image.alpha_composite(img, sym)

def favicon_png(size=196):
    return icon_png(size)

# ── main ─────────────────────────────────────────────────────────────────────

assets = [
    ('icon.png',                      lambda: icon_png(1024)),
    ('splash-icon.png',               lambda: splash_png(800)),
    ('android-icon-foreground.png',   lambda: foreground_png(1024)),
    ('android-icon-background.png',   lambda: background_png(1024)),
    ('android-icon-monochrome.png',   lambda: monochrome_png(1024)),
    ('favicon.png',                   lambda: favicon_png(196)),
]

for filename, generator in assets:
    path = os.path.join(OUT, filename)
    img  = generator()
    img.save(path)
    print(f'  ✓ {filename}')

print('\nAssets gerados com sucesso.')
