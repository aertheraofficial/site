#!/usr/bin/env python3

from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import remove
from rembg.session_factory import new_session
from scipy import ndimage
from scipy.ndimage import gaussian_filter1d


CATALOG_PATH = Path("content/catalog.json")
MASTER_OUTPUT_DIR = Path("public/assets/products/clean-cutouts-masters")
CATALOG_OUTPUT_DIR = Path("public/assets/products/catalog-card-cutouts")
DETAIL_OUTPUT_DIR = Path("public/assets/products/detail-hero-cutouts")

CANVASES = {
    "catalog": (1000, 1250),
    "detail": (1200, 1440),
}

TEMPLATES = {
    "catalog": {
        "pump": {"box": (314, 128, 669, 1147), "fit": "height", "align": "bottom-center"},
        "dropper": {"box": (338, 150, 661, 1134), "fit": "height", "align": "bottom-center"},
        "spray": {"box": (360, 200, 640, 1124), "fit": "height", "align": "bottom-center"},
        "small_bottle": {
            "box": (322, 239, 676, 1135),
            "fit": "height",
            "align": "bottom-center",
        },
        "roll_on": {"box": (364, 176, 636, 1152), "fit": "height", "align": "bottom-center"},
        "wide_jar": {"box": (149, 411, 852, 1116), "fit": "contain", "align": "center"},
        "reed": {"box": (378, 88, 624, 1145), "fit": "height", "align": "bottom-center"},
    },
    "detail": {
        "pump": {"box": (380, 116, 804, 1331), "fit": "height", "align": "bottom-center"},
        "dropper": {
            "box": (405, 150, 792, 1328),
            "fit": "height",
            "align": "bottom-center",
        },
        "spray": {"box": (435, 206, 765, 1310), "fit": "height", "align": "bottom-center"},
        "small_bottle": {
            "box": (387, 237, 811, 1308),
            "fit": "height",
            "align": "bottom-center",
        },
        "roll_on": {"box": (440, 188, 760, 1330), "fit": "height", "align": "bottom-center"},
        "wide_jar": {"box": (196, 435, 1005, 1245), "fit": "contain", "align": "center"},
        "reed": {"box": (457, 110, 744, 1343), "fit": "height", "align": "bottom-center"},
    },
}

SLUG_TEMPLATE_OVERRIDES: dict[str, dict[str, dict[str, object]]] = {
    "catalog": {
        "scented-oil-pink-chiffon-10ml": {
            "box": (300, 220, 700, 1147),
            "fit": "contain",
            "align": "bottom-center",
        }
    },
    "detail": {
        "scented-oil-pink-chiffon-10ml": {
            "box": (360, 214, 840, 1318),
            "fit": "contain",
            "align": "bottom-center",
        }
    },
}

SEED_OVERRIDES: dict[str, dict[str, Path]] = {
    "body-cleanse-shower-gel-lemongrass-malaya-230ml": {
        "master": Path(
            "public/assets/products/homepage-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-cutout-v3.png"
        ),
        "catalog": Path(
            "public/assets/products/homepage-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-cutout-v3.png"
        ),
        "detail": Path(
            "public/assets/products/product-detail-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-detail-v1.png"
        ),
    },
    "calm-mousseline-lemongrass-malaya-60ml": {
        "master": Path(
            "public/assets/products/homepage-cutouts/calm-mousseline-lemongrass-malaya-60ml-cutout-v3.png"
        ),
        "catalog": Path(
            "public/assets/products/homepage-cutouts/calm-mousseline-lemongrass-malaya-60ml-cutout-v3.png"
        ),
        "detail": Path(
            "public/assets/products/product-detail-cutouts/calm-mousseline-lemongrass-malaya-60ml-detail-v1.png"
        ),
    },
    "essential-oil-lemongrass-malaya-10ml": {
        "master": Path(
            "public/assets/products/homepage-cutouts/essential-oil-lemongrass-malaya-10ml-cutout-v3.png"
        ),
        "catalog": Path(
            "public/assets/products/homepage-cutouts/essential-oil-lemongrass-malaya-10ml-cutout-v3.png"
        ),
        "detail": Path(
            "public/assets/products/product-detail-cutouts/essential-oil-lemongrass-malaya-10ml-detail-v1.png"
        ),
    },
    "reed-diffuser-lemongrass-malaya-230ml": {
        "master": Path(
            "public/assets/products/homepage-cutouts/reed-diffuser-lemongrass-malaya-230ml-cutout-master-v3.png"
        ),
        "catalog": Path(
            "public/assets/products/homepage-cutouts/reed-diffuser-lemongrass-malaya-230ml-cutout-v4.png"
        ),
        "detail": Path(
            "public/assets/products/product-detail-cutouts/reed-diffuser-lemongrass-malaya-230ml-detail-v2.png"
        ),
    },
}

SOURCE_CROP_OVERRIDES: dict[str, tuple[int, int, int, int]] = {
    "scented-oil-pink-chiffon-10ml": (520, 380, 1240, 1760),
}

COLOR_STRIP_OVERRIDES: dict[str, dict[str, float]] = {
    "scented-oil-pink-chiffon-10ml": {
        "min_x_ratio": 0.72,
        "min_y_ratio": 0.78,
        "red": 140.0,
        "green": 110.0,
        "blue": 90.0,
    },
}


def estimate_background(rgb: np.ndarray) -> np.ndarray:
    height, width, _ = rgb.shape
    pad = max(24, min(height, width) // 18)
    patches = [
        rgb[:pad, :pad],
        rgb[:pad, -pad:],
        rgb[-pad:, :pad],
        rgb[-pad:, -pad:],
    ]
    return np.median(
        np.concatenate([patch.reshape(-1, 3) for patch in patches], axis=0),
        axis=0,
    ).astype(np.float32)


def alpha_bbox(alpha: np.ndarray, threshold: int = 1) -> tuple[int, int, int, int]:
    ys, xs = np.where(alpha >= threshold)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def largest_centered_component(mask: np.ndarray) -> np.ndarray:
    labels, count = ndimage.label(mask)
    if not count:
        return mask

    height, width = mask.shape
    center_y = height / 2.0
    center_x = width / 2.0
    best_score = -1.0
    best_label = 0

    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        if xs.size == 0:
            continue
        area = float(xs.size)
        component_center_x = float(xs.mean())
        component_center_y = float(ys.mean())
        distance = ((component_center_x - center_x) ** 2 + (component_center_y - center_y) ** 2) ** 0.5
        score = area / (1.0 + distance * 0.02)
        if score > best_score:
            best_score = score
            best_label = label

    return labels == best_label


def family_for_slug(slug: str) -> str:
    if slug.startswith("reed-diffuser-"):
        return "reed"
    if slug.startswith("calm-mousseline-") or slug.startswith("scented-candle-"):
        return "wide_jar"
    if slug.startswith("roll-on-essential-oil-"):
        return "roll_on"
    if slug.startswith("scented-spray-"):
        return "spray"
    if slug.startswith("body-cleanse-shower-gel-"):
        return "pump"
    if slug.startswith("body-oil-") or slug.startswith("hair-root-serum-"):
        return "dropper"
    if (
        slug.startswith("essential-oil-")
        or slug.startswith("essential-oil-blend-")
        or slug.startswith("scented-oil-")
    ):
        return "small_bottle"
    return "pump"


def maybe_crop_source(slug: str, source_rgb: np.ndarray) -> np.ndarray:
    crop = SOURCE_CROP_OVERRIDES.get(slug)
    if not crop:
        return source_rgb
    x1, y1, x2, y2 = crop
    return source_rgb[y1:y2, x1:x2]


def generate_seed_from_rgb(source_rgb: np.ndarray, session) -> np.ndarray:
    buffer = io.BytesIO()
    Image.fromarray(source_rgb).save(buffer, format="PNG")
    seed_bytes = remove(buffer.getvalue(), session=session, post_process_mask=True)
    rgba = np.array(Image.open(io.BytesIO(seed_bytes)).convert("RGBA"))
    alpha_mask = rgba[:, :, 3] > 0
    alpha_mask = largest_centered_component(alpha_mask)
    rgba[:, :, 3] = np.where(alpha_mask, rgba[:, :, 3], 0)
    return rgba


def clean_seed(seed_rgba: np.ndarray, background: np.ndarray) -> np.ndarray:
    rgba = seed_rgba.astype(np.float32)
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3] / 255.0

    safe_alpha = np.maximum(alpha[..., None], 1e-3)
    foreground = (rgb - (1.0 - alpha[..., None]) * background) / safe_alpha
    foreground = np.clip(foreground, 0, 255)

    strong_mask = alpha >= (110.0 / 255.0)
    valid_columns = np.where(strong_mask.any(axis=0))[0]
    if valid_columns.size:
        bottom_edge = np.full(alpha.shape[1], np.nan)
        bottom_edge[valid_columns] = [
            np.where(strong_mask[:, column])[0].max() for column in valid_columns
        ]
        valid = np.where(~np.isnan(bottom_edge))[0]
        bottom_curve = gaussian_filter1d(
            np.interp(np.arange(alpha.shape[1]), valid, bottom_edge[valid]),
            sigma=4,
        )
        yy = np.indices(alpha.shape)[0]
        shadow_region = yy > bottom_curve[None, :] + 2
        alpha[(shadow_region) & (alpha < (90.0 / 255.0))] = 0.0

    alpha[alpha < 0.02] = 0.0
    return np.dstack([foreground, alpha[..., None] * 255]).astype(np.uint8)


def strip_color_props(slug: str, rgba: np.ndarray) -> np.ndarray:
    config = COLOR_STRIP_OVERRIDES.get(slug)
    if not config:
        return rgba

    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    yy, xx = np.indices(alpha.shape)
    remove_mask = (
        (alpha > 0)
        & (xx > alpha.shape[1] * config["min_x_ratio"])
        & (yy > alpha.shape[0] * config["min_y_ratio"])
        & (rgb[:, :, 0] > config["red"])
        & (rgb[:, :, 1] > config["green"])
        & (rgb[:, :, 2] > config["blue"])
    )
    rgba[:, :, 3] = np.where(remove_mask, 0, alpha)
    return rgba


def normalize_to_template(
    master_rgba: np.ndarray,
    stage: str,
    family: str,
    slug: str,
) -> np.ndarray:
    canvas_width, canvas_height = CANVASES[stage]
    template = SLUG_TEMPLATE_OVERRIDES.get(stage, {}).get(slug, TEMPLATES[stage][family])
    box_x1, box_y1, box_x2, box_y2 = template["box"]
    box_width = box_x2 - box_x1 + 1
    box_height = box_y2 - box_y1 + 1

    master_alpha = master_rgba[:, :, 3]
    crop_x1, crop_y1, crop_x2, crop_y2 = alpha_bbox(master_alpha, threshold=1)
    crop = master_rgba[crop_y1 : crop_y2 + 1, crop_x1 : crop_x2 + 1]
    crop_height, crop_width = crop.shape[:2]

    if template["fit"] == "height":
        scale = box_height / crop_height
        if crop_width * scale > box_width:
            scale = box_width / crop_width
    elif template["fit"] == "width":
        scale = box_width / crop_width
        if crop_height * scale > box_height:
            scale = box_height / crop_height
    else:
        scale = min(box_width / crop_width, box_height / crop_height)

    resized = Image.fromarray(crop).resize(
        (max(1, round(crop_width * scale)), max(1, round(crop_height * scale))),
        Image.Resampling.LANCZOS,
    )
    resized_rgba = np.array(resized)
    resized_height, resized_width = resized_rgba.shape[:2]

    if template["align"] == "bottom-center":
        x0 = int(round(box_x1 + (box_width - resized_width) / 2.0))
        y0 = int(round(box_y2 - resized_height + 1))
    else:
        x0 = int(round(box_x1 + (box_width - resized_width) / 2.0))
        y0 = int(round(box_y1 + (box_height - resized_height) / 2.0))

    canvas = np.zeros((canvas_height, canvas_width, 4), dtype=np.uint8)
    x1 = max(0, x0)
    y1 = max(0, y0)
    x2 = min(canvas_width, x0 + resized_width)
    y2 = min(canvas_height, y0 + resized_height)
    src_x1 = x1 - x0
    src_y1 = y1 - y0
    src_x2 = src_x1 + (x2 - x1)
    src_y2 = src_y1 + (y2 - y1)
    canvas[y1:y2, x1:x2] = resized_rgba[src_y1:src_y2, src_x1:src_x2]
    return canvas


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text())
    session = new_session("u2net")

    MASTER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CATALOG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DETAIL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for product in catalog["products"]:
        slug = product["slug"]
        image_path = Path("public") / product["image"].lstrip("/")
        if image_path.suffix.lower() != ".png":
            continue

        family = family_for_slug(slug)
        source_rgb_full = np.array(Image.open(image_path).convert("RGB"))
        source_rgb = maybe_crop_source(slug, source_rgb_full)
        background = estimate_background(source_rgb)[None, None, :]

        override = SEED_OVERRIDES.get(slug)
        if override:
            master_seed = np.array(Image.open(override["master"]).convert("RGBA"))
            catalog_seed = np.array(Image.open(override["catalog"]).convert("RGBA"))
            detail_seed = np.array(Image.open(override["detail"]).convert("RGBA"))

            master_clean = strip_color_props(slug, clean_seed(master_seed, background))
            catalog_clean = strip_color_props(slug, clean_seed(catalog_seed, background))
            detail_clean = strip_color_props(slug, clean_seed(detail_seed, background))
        else:
            seed = generate_seed_from_rgb(source_rgb, session)
            master_clean = strip_color_props(slug, clean_seed(seed, background))
            catalog_clean = normalize_to_template(master_clean, "catalog", family, slug)
            detail_clean = normalize_to_template(master_clean, "detail", family, slug)

        Image.fromarray(master_clean).save(MASTER_OUTPUT_DIR / f"{slug}.png")
        Image.fromarray(catalog_clean).save(CATALOG_OUTPUT_DIR / f"{slug}.png")
        Image.fromarray(detail_clean).save(DETAIL_OUTPUT_DIR / f"{slug}.png")
        print(f"built {slug}")


if __name__ == "__main__":
    main()
