#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content/catalog.json"
OUTPUT_DIR = ROOT / "public/assets/brand/product-card-hover"
WIDTH = 900
HEIGHT = 1200
OPACITY_MULTIPLIER = 1.6
MAX_SHAPE_OPACITY = 0.52

COLLECTION_MOTIFS = {
    "lemongrass-malaya": "lemongrass",
    "pineapple-tropical": "tropical",
    "sleep-calm": "moon",
    "stress-relief": "ripple",
    "soft-aura": "aura",
    "energy-shield": "shield",
    "golden-bloom": "bloom",
    "floral-balance": "petal",
    "serene-space": "mist",
    "jade-tea": "tea",
    "happy": "sunburst",
    "rose": "rose",
    "pink-chiffon": "chiffon",
}

CATEGORY_MOTIFS = {
    "body cleanse shower gel": "cascade",
    "body cleanse shower oil": "oil-wave",
    "calm mousseline": "cloud",
    "body oil": "droplet",
    "hair root serum": "roots",
    "reed diffuser": "reeds",
    "scented candle": "flame",
    "essential oil": "orbit",
    "essential oil blend": "orbital-star",
    "scented spray": "spray",
    "roll on essential oil": "roll",
    "scented oil": "ribbon",
}


def slugify(value: str) -> str:
    return (
        value.strip().lower().replace("&", "and").replace("/", "-").replace(" ", "-")
        .replace("--", "-")
    )


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def mix(color_a: str, color_b: str, amount: float) -> str:
    rgb_a = hex_to_rgb(color_a)
    rgb_b = hex_to_rgb(color_b)
    mixed = tuple(
        round(channel_a * (1 - amount) + channel_b * amount)
        for channel_a, channel_b in zip(rgb_a, rgb_b)
    )
    return rgb_to_hex(mixed)


def palette_for_product(accent: str) -> dict[str, str]:
    return {
        "base": mix(accent, "#f7efe1", 0.84),
        "wash": mix(accent, "#ead6b6", 0.54),
        "accent": mix(accent, "#ffffff", 0.1),
        "deep": mix(accent, "#33271b", 0.72),
        "glow": mix(accent, "#fff7d8", 0.8),
        "veil": mix(accent, "#fff4dc", 0.42),
    }


def seed_for_slug(slug: str) -> int:
    return int(hashlib.sha1(slug.encode("utf-8")).hexdigest()[:8], 16)


def circle(cx: int, cy: int, r: int, fill: str, opacity: float, blur: str = "") -> str:
    filter_attr = f' filter="url(#{blur})"' if blur else ""
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" opacity="{resolved_opacity(opacity)}"'
        f"{filter_attr} />"
    )


def ellipse(
    cx: int,
    cy: int,
    rx: int,
    ry: int,
    fill: str,
    opacity: float,
    transform: str = "",
    blur: str = "",
) -> str:
    transform_attr = f' transform="{transform}"' if transform else ""
    filter_attr = f' filter="url(#{blur})"' if blur else ""
    return (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" opacity="{resolved_opacity(opacity)}"'
        f"{transform_attr}{filter_attr} />"
    )


def path(d: str, stroke: str, width: int, opacity: float, fill: str = "none") -> str:
    return (
        f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" '
        f'stroke-linecap="round" stroke-linejoin="round" opacity="{resolved_opacity(opacity)}" />'
    )


def resolved_opacity(opacity: float) -> float:
    return min(round(opacity * OPACITY_MULTIPLIER, 3), MAX_SHAPE_OPACITY)


def primary_motif_shapes(motif: str, theme: dict[str, str], seed: int) -> list[str]:
    accent = theme["accent"]
    deep = theme["deep"]
    glow = theme["glow"]
    offset_x = (seed % 45) - 22
    offset_y = ((seed // 7) % 35) - 17
    shapes: list[str] = []

    if motif == "lemongrass":
        shapes.extend(
            [
                path(
                    f"M{110 + offset_x} 1150 C{250 + offset_x} 930 {330 + offset_x} 700 {415 + offset_x} {340 + offset_y}",
                    deep,
                    14,
                    0.22,
                ),
                path(
                    f"M{215 + offset_x} 1145 C{360 + offset_x} 920 {480 + offset_x} 710 {595 + offset_x} {250 + offset_y}",
                    accent,
                    18,
                    0.2,
                ),
                path(
                    f"M{360 + offset_x} 1185 C{520 + offset_x} 930 {660 + offset_x} 700 {770 + offset_x} {215 + offset_y}",
                    deep,
                    12,
                    0.18,
                ),
                ellipse(650 + offset_x, 230 + offset_y, 130, 120, glow, 0.34, blur="blurSoft"),
            ]
        )
    elif motif == "tropical":
        shapes.extend(
            [
                ellipse(680 + offset_x, 220 + offset_y, 175, 165, glow, 0.3, blur="blurSoft"),
                path(
                    f"M{145 + offset_x} 1085 L{420 + offset_x} 560 L{770 + offset_x} 1085",
                    accent,
                    18,
                    0.16,
                ),
                path(
                    f"M{180 + offset_x} 980 L{390 + offset_x} 710 L{620 + offset_x} 980",
                    deep,
                    14,
                    0.14,
                ),
            ]
        )
    elif motif == "moon":
        shapes.extend(
            [
                circle(660 + offset_x, 220 + offset_y, 120, glow, 0.4, blur="blurSoft"),
                circle(640 + offset_x, 220 + offset_y, 92, "#f7f4ff", 0.72),
                circle(680 + offset_x, 200 + offset_y, 82, theme["base"], 0.9),
                path(
                    f"M80 1000 C260 900 520 900 {820 + offset_x} 990",
                    accent,
                    14,
                    0.12,
                ),
            ]
        )
    elif motif == "ripple":
        shapes.extend(
            [
                circle(650 + offset_x, 270 + offset_y, 195, glow, 0.24, blur="blurSoft"),
                path("M190 720 C320 635 470 635 600 720", accent, 14, 0.18),
                path("M145 795 C330 675 540 680 730 795", deep, 12, 0.15),
                path("M100 880 C350 720 610 730 835 880", accent, 10, 0.12),
            ]
        )
    elif motif == "aura":
        shapes.extend(
            [
                ellipse(650 + offset_x, 285 + offset_y, 220, 165, glow, 0.26, blur="blurSoft"),
                path(
                    f"M420 {300 + offset_y} C470 155 820 155 865 {300 + offset_y}",
                    accent,
                    10,
                    0.18,
                ),
                path(
                    f"M455 {348 + offset_y} C510 245 790 245 830 {348 + offset_y}",
                    deep,
                    8,
                    0.16,
                ),
            ]
        )
    elif motif == "shield":
        shapes.extend(
            [
                path(
                    f"M450 {165 + offset_y} C620 {165 + offset_y} 710 {220 + offset_y} 710 {360 + offset_y} "
                    f"C710 {520 + offset_y} 580 {620 + offset_y} 450 {735 + offset_y} "
                    f"C320 {620 + offset_y} 190 {520 + offset_y} 190 {360 + offset_y} "
                    f"C190 {220 + offset_y} 280 {165 + offset_y} 450 {165 + offset_y}",
                    accent,
                    16,
                    0.15,
                    fill=glow,
                ),
                path(
                    f"M450 {235 + offset_y} C560 {235 + offset_y} 620 {280 + offset_y} 620 {365 + offset_y} "
                    f"C620 {470 + offset_y} 535 {560 + offset_y} 450 {655 + offset_y} "
                    f"C365 {560 + offset_y} 280 {470 + offset_y} 280 {365 + offset_y} "
                    f"C280 {280 + offset_y} 340 {235 + offset_y} 450 {235 + offset_y}",
                    deep,
                    10,
                    0.18,
                ),
            ]
        )
    elif motif == "bloom":
        for angle in ["0", "45", "90", "135"]:
            shapes.append(
                ellipse(
                    660 + offset_x,
                    250 + offset_y,
                    76,
                    190,
                    glow,
                    0.22,
                    transform=f"rotate({angle} {660 + offset_x} {250 + offset_y})",
                )
            )
        shapes.append(circle(660 + offset_x, 250 + offset_y, 58, "#fff6cf", 0.56))
    elif motif == "petal":
        shapes.extend(
            [
                ellipse(645 + offset_x, 265 + offset_y, 108, 192, glow, 0.22, transform=f"rotate(-28 {645 + offset_x} {265 + offset_y})"),
                ellipse(720 + offset_x, 325 + offset_y, 90, 170, accent, 0.16, transform=f"rotate(18 {720 + offset_x} {325 + offset_y})"),
                ellipse(560 + offset_x, 360 + offset_y, 110, 165, "#fff5ef", 0.18, transform=f"rotate(25 {560 + offset_x} {360 + offset_y})"),
            ]
        )
    elif motif == "mist":
        shapes.extend(
            [
                ellipse(640 + offset_x, 230 + offset_y, 250, 120, glow, 0.3, blur="blurSoft"),
                ellipse(290 + offset_x, 950, 330, 130, accent, 0.12, blur="blurSoft"),
                path("M80 980 C240 900 530 900 820 1000", deep, 12, 0.1),
            ]
        )
    elif motif == "tea":
        shapes.extend(
            [
                circle(640 + offset_x, 250 + offset_y, 145, glow, 0.26, blur="blurSoft"),
                path(
                    f"M460 {255 + offset_y} C560 {175 + offset_y} 705 {175 + offset_y} 790 {255 + offset_y}",
                    deep,
                    10,
                    0.16,
                ),
                path(
                    f"M500 {315 + offset_y} C590 {245 + offset_y} 685 {245 + offset_y} 755 {315 + offset_y}",
                    accent,
                    12,
                    0.14,
                ),
            ]
        )
    elif motif == "sunburst":
        center_x = 660 + offset_x
        center_y = 240 + offset_y
        for index in range(9):
            ray_x = center_x - 120 + index * 30
            shapes.append(path(f"M{ray_x} 70 L{ray_x + 60} {center_y}", "#fff8d0", 8, 0.2))
        shapes.append(circle(center_x, center_y, 88, glow, 0.38))
    elif motif == "rose":
        shapes.extend(
            [
                ellipse(650 + offset_x, 255 + offset_y, 130, 88, glow, 0.22, blur="blurSoft"),
                path(
                    f"M585 {330 + offset_y} C645 {200 + offset_y} 730 {200 + offset_y} 780 {320 + offset_y}",
                    deep,
                    12,
                    0.16,
                ),
                path(
                    f"M560 {375 + offset_y} C655 {260 + offset_y} 760 {270 + offset_y} 805 {385 + offset_y}",
                    accent,
                    10,
                    0.14,
                ),
            ]
        )
    elif motif == "chiffon":
        shapes.extend(
            [
                ellipse(650 + offset_x, 235 + offset_y, 230, 125, glow, 0.28, blur="blurSoft"),
                path("M95 930 C260 850 520 840 830 920", accent, 12, 0.12),
                path("M150 1015 C360 935 620 930 830 1005", deep, 10, 0.1),
            ]
        )
    else:
        shapes.extend(
            [
                ellipse(650 + offset_x, 240 + offset_y, 220, 135, glow, 0.28, blur="blurSoft"),
                path("M110 980 C260 860 540 860 810 965", accent, 12, 0.12),
            ]
        )

    return shapes


def secondary_motif_shapes(motif: str, theme: dict[str, str], seed: int) -> list[str]:
    accent = theme["accent"]
    deep = theme["deep"]
    veil = theme["veil"]
    x_shift = ((seed // 11) % 70) - 35
    y_shift = ((seed // 17) % 50) - 25

    if motif == "cascade":
        return [
            path(
                f"M{730 + x_shift} {120 + y_shift} C{650 + x_shift} 390 {645 + x_shift} 660 {700 + x_shift} 1090",
                veil,
                18,
                0.18,
            ),
            path(
                f"M{820 + x_shift} {180 + y_shift} C{720 + x_shift} 440 {720 + x_shift} 760 {785 + x_shift} 1140",
                deep,
                12,
                0.12,
            ),
        ]
    if motif == "oil-wave":
        return [
            ellipse(290 + x_shift, 1000 + y_shift, 330, 110, veil, 0.16, blur="blurSoft"),
            path("M40 930 C220 850 500 860 760 945", accent, 18, 0.14),
            path("M120 1010 C340 920 620 930 860 1030", deep, 12, 0.12),
        ]
    if motif == "cloud":
        return [
            ellipse(250 + x_shift, 930 + y_shift, 150, 70, veil, 0.18, blur="blurSoft"),
            ellipse(385 + x_shift, 905 + y_shift, 120, 58, accent, 0.16, blur="blurSoft"),
            ellipse(140 + x_shift, 955 + y_shift, 100, 50, deep, 0.1, blur="blurSoft"),
        ]
    if motif == "droplet":
        return [
            ellipse(760 + x_shift, 880 + y_shift, 108, 185, veil, 0.16, transform=f"rotate(18 {760 + x_shift} {880 + y_shift})"),
            path(
                f"M{740 + x_shift} {690 + y_shift} C{830 + x_shift} {860 + y_shift} {830 + x_shift} {985 + y_shift} {710 + x_shift} {1060 + y_shift}",
                deep,
                12,
                0.12,
            ),
        ]
    if motif == "roots":
        return [
            path(
                f"M{150 + x_shift} 1120 C{250 + x_shift} 1010 {315 + x_shift} 920 {380 + x_shift} 760",
                deep,
                14,
                0.14,
            ),
            path(
                f"M{235 + x_shift} 1135 C{360 + x_shift} 1005 {450 + x_shift} 900 {550 + x_shift} 720",
                accent,
                12,
                0.13,
            ),
            path(
                f"M{110 + x_shift} 1085 C{220 + x_shift} 1005 {270 + x_shift} 930 {315 + x_shift} 845",
                veil,
                9,
                0.12,
            ),
        ]
    if motif == "reeds":
        return [
            path(
                f"M{140 + x_shift} 1120 L{360 + x_shift} {650 + y_shift}",
                deep,
                12,
                0.12,
            ),
            path(
                f"M{250 + x_shift} 1135 L{480 + x_shift} {615 + y_shift}",
                accent,
                14,
                0.12,
            ),
            path(
                f"M{355 + x_shift} 1130 L{600 + x_shift} {640 + y_shift}",
                veil,
                10,
                0.12,
            ),
        ]
    if motif == "flame":
        return [
            ellipse(175 + x_shift, 940 + y_shift, 82, 190, veil, 0.16, transform=f"rotate(-16 {175 + x_shift} {940 + y_shift})"),
            ellipse(190 + x_shift, 960 + y_shift, 46, 108, accent, 0.16, transform=f"rotate(-16 {190 + x_shift} {960 + y_shift})"),
        ]
    if motif == "orbit":
        return [
            path(
                f"M{470 + x_shift} {930 + y_shift} C{565 + x_shift} {815 + y_shift} {760 + x_shift} {815 + y_shift} {850 + x_shift} {930 + y_shift}",
                veil,
                14,
                0.16,
            ),
            path(
                f"M{520 + x_shift} {1020 + y_shift} C{620 + x_shift} {895 + y_shift} {785 + x_shift} {905 + y_shift} {875 + x_shift} {1035 + y_shift}",
                accent,
                10,
                0.12,
            ),
            circle(615 + x_shift, 870 + y_shift, 18, accent, 0.22),
        ]
    if motif == "orbital-star":
        return [
            path(
                f"M{700 + x_shift} {890 + y_shift} L{738 + x_shift} {968 + y_shift} L{824 + x_shift} {982 + y_shift} L{758 + x_shift} {1036 + y_shift} "
                f"L{776 + x_shift} {1120 + y_shift} L{700 + x_shift} {1078 + y_shift} L{624 + x_shift} {1120 + y_shift} L{642 + x_shift} {1036 + y_shift} "
                f"L{576 + x_shift} {982 + y_shift} L{662 + x_shift} {968 + y_shift} Z",
                deep,
                4,
                0.12,
                fill=veil,
            ),
        ]
    if motif == "spray":
        return [
            circle(165 + x_shift, 980 + y_shift, 18, accent, 0.22),
            circle(245 + x_shift, 940 + y_shift, 14, veil, 0.2),
            circle(330 + x_shift, 900 + y_shift, 11, deep, 0.15),
            circle(395 + x_shift, 860 + y_shift, 8, accent, 0.18),
            path(
                f"M{170 + x_shift} {1000 + y_shift} L{330 + x_shift} {890 + y_shift}",
                accent,
                10,
                0.12,
            ),
        ]
    if motif == "roll":
        return [
            path(
                f"M{540 + x_shift} {1030 + y_shift} C{660 + x_shift} {875 + y_shift} {805 + x_shift} {885 + y_shift} {895 + x_shift} {1020 + y_shift}",
                veil,
                14,
                0.16,
            ),
            path(
                f"M{500 + x_shift} {1110 + y_shift} C{660 + x_shift} {930 + y_shift} {830 + x_shift} {955 + y_shift} {900 + x_shift} {1100 + y_shift}",
                accent,
                12,
                0.12,
            ),
        ]
    if motif == "ribbon":
        return [
            path(
                f"M60 {955 + y_shift} C250 {870 + y_shift} 470 {1045 + y_shift} 690 {970 + y_shift} C800 {932 + y_shift} 860 {965 + y_shift} 920 {1015 + y_shift}",
                veil,
                22,
                0.16,
            ),
            path(
                f"M110 {1025 + y_shift} C330 {930 + y_shift} 540 {1095 + y_shift} 790 {1020 + y_shift}",
                accent,
                14,
                0.12,
            ),
        ]

    return [ellipse(700 + x_shift, 955 + y_shift, 160, 70, veil, 0.12, blur="blurSoft")]


def render_svg(product: dict[str, object]) -> str:
    slug = str(product["slug"])
    seed = seed_for_slug(slug)
    collection = next(
        (
            detail["value"]
            for detail in product["details"]
            if detail["label"].strip().lower() == "collection"
        ),
        "",
    )
    collection_key = slugify(str(collection))
    category_key = slugify(str(product["categoryLabel"]))
    theme = palette_for_product(str(product["accent"]))
    primary_motif = COLLECTION_MOTIFS.get(collection_key, "mist")
    secondary_motif = CATEGORY_MOTIFS.get(category_key, "ribbon")

    shapes = [
        ellipse(210 + (seed % 50), 170, 290, 190, theme["wash"], 0.48, blur="blurHeavy"),
        ellipse(720 - (seed % 35), 870, 250, 225, theme["accent"], 0.14, blur="blurHeavy"),
        ellipse(170 + (seed % 40), 1040, 250, 150, theme["glow"], 0.18, blur="blurSoft"),
        *primary_motif_shapes(primary_motif, theme, seed),
        *secondary_motif_shapes(secondary_motif, theme, seed),
    ]

    shapes_markup = "\n  ".join(shapes)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" fill="none">
  <defs>
    <filter id="blurHeavy" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="90" />
    </filter>
    <filter id="blurSoft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="35" />
    </filter>
    <linearGradient id="panelWash" x1="0" y1="0" x2="0" y2="{HEIGHT}">
      <stop offset="0%" stop-color="{theme['base']}" />
      <stop offset="42%" stop-color="{theme['wash']}" stop-opacity="0.78" />
      <stop offset="100%" stop-color="{theme['base']}" />
    </linearGradient>
  </defs>
  <rect width="{WIDTH}" height="{HEIGHT}" fill="url(#panelWash)" />
  <rect width="{WIDTH}" height="{HEIGHT}" fill="#ffffff" opacity="0.08" />
  {shapes_markup}
</svg>
"""


def reset_output_directory() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for existing in OUTPUT_DIR.iterdir():
        if existing.is_file():
            existing.unlink()


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text())
    reset_output_directory()

    for product in catalog["products"]:
        output_path = OUTPUT_DIR / f'{product["slug"]}.svg'
        output_path.write_text(render_svg(product))
        print(f"generated {output_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
