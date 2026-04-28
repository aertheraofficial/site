#!/usr/bin/env python3

from __future__ import annotations

import io
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import remove
from rembg.session_factory import new_session
from scipy import ndimage
from scipy.ndimage import gaussian_filter1d


REFERENCE_ALPHA_THRESHOLD = 128

PRODUCTS: dict[str, dict[str, object]] = {
    "body-cleanse-shower-gel-lemongrass-malaya-230ml": {
        "source": Path("public/assets/products/catalog/body-cleanse-shower-gel-lemongrass-malaya-230ml.png"),
        "master": Path(
            "public/assets/products/clean-cutouts-masters/body-cleanse-shower-gel-lemongrass-malaya-230ml-master-v2.png"
        ),
        "master_seed": Path(
            "public/assets/products/homepage-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-cutout-v3.png"
        ),
        "homepage_reference": Path(
            "public/assets/products/homepage-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-cutout-v3.png"
        ),
        "homepage_seed": Path(
            "public/assets/products/homepage-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-cutout-v3.png"
        ),
        "homepage_output": Path(
            "public/assets/products/homepage-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-cutout-v6.png"
        ),
        "detail_reference": Path(
            "public/assets/products/product-detail-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-detail-v1.png"
        ),
        "detail_seed": Path(
            "public/assets/products/product-detail-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-detail-v1.png"
        ),
        "detail_output": Path(
            "public/assets/products/product-detail-cutouts/body-cleanse-shower-gel-lemongrass-malaya-230ml-detail-v4.png"
        ),
        "fit_mode": "height",
        "use_envelope_cleanup": True,
    },
    "reed-diffuser-lemongrass-malaya-230ml": {
        "source": Path("public/assets/products/catalog/reed-diffuser-lemongrass-malaya-230ml.png"),
        "master": Path(
            "public/assets/products/clean-cutouts-masters/reed-diffuser-lemongrass-malaya-230ml-master-v2.png"
        ),
        "master_seed": Path(
            "public/assets/products/homepage-cutouts/reed-diffuser-lemongrass-malaya-230ml-cutout-master-v3.png"
        ),
        "homepage_reference": Path(
            "public/assets/products/homepage-cutouts/reed-diffuser-lemongrass-malaya-230ml-cutout-v4.png"
        ),
        "homepage_seed": Path(
            "public/assets/products/homepage-cutouts/reed-diffuser-lemongrass-malaya-230ml-cutout-v4.png"
        ),
        "homepage_output": Path(
            "public/assets/products/homepage-cutouts/reed-diffuser-lemongrass-malaya-230ml-cutout-v7.png"
        ),
        "detail_reference": Path(
            "public/assets/products/product-detail-cutouts/reed-diffuser-lemongrass-malaya-230ml-detail-v2.png"
        ),
        "detail_seed": Path(
            "public/assets/products/product-detail-cutouts/reed-diffuser-lemongrass-malaya-230ml-detail-v2.png"
        ),
        "detail_output": Path(
            "public/assets/products/product-detail-cutouts/reed-diffuser-lemongrass-malaya-230ml-detail-v5.png"
        ),
        "fit_mode": "height",
        "use_envelope_cleanup": True,
    },
    "calm-mousseline-lemongrass-malaya-60ml": {
        "source": Path("public/assets/products/catalog/calm-mousseline-lemongrass-malaya-60ml.png"),
        "master": Path(
            "public/assets/products/clean-cutouts-masters/calm-mousseline-lemongrass-malaya-60ml-master-v2.png"
        ),
        "master_seed": Path(
            "public/assets/products/homepage-cutouts/calm-mousseline-lemongrass-malaya-60ml-cutout-v3.png"
        ),
        "homepage_reference": Path(
            "public/assets/products/homepage-cutouts/calm-mousseline-lemongrass-malaya-60ml-cutout-v3.png"
        ),
        "homepage_seed": Path(
            "public/assets/products/homepage-cutouts/calm-mousseline-lemongrass-malaya-60ml-cutout-v3.png"
        ),
        "homepage_output": Path(
            "public/assets/products/homepage-cutouts/calm-mousseline-lemongrass-malaya-60ml-cutout-v6.png"
        ),
        "detail_reference": Path(
            "public/assets/products/product-detail-cutouts/calm-mousseline-lemongrass-malaya-60ml-detail-v1.png"
        ),
        "detail_seed": Path(
            "public/assets/products/product-detail-cutouts/calm-mousseline-lemongrass-malaya-60ml-detail-v1.png"
        ),
        "detail_output": Path(
            "public/assets/products/product-detail-cutouts/calm-mousseline-lemongrass-malaya-60ml-detail-v4.png"
        ),
        "fit_mode": "contain",
        "use_envelope_cleanup": False,
    },
    "essential-oil-lemongrass-malaya-10ml": {
        "source": Path("public/assets/products/catalog/essential-oil-lemongrass-malaya-10ml.png"),
        "master": Path(
            "public/assets/products/clean-cutouts-masters/essential-oil-lemongrass-malaya-10ml-master-v2.png"
        ),
        "master_seed": Path(
            "public/assets/products/homepage-cutouts/essential-oil-lemongrass-malaya-10ml-cutout-v3.png"
        ),
        "homepage_reference": Path(
            "public/assets/products/homepage-cutouts/essential-oil-lemongrass-malaya-10ml-cutout-v3.png"
        ),
        "homepage_seed": Path(
            "public/assets/products/homepage-cutouts/essential-oil-lemongrass-malaya-10ml-cutout-v3.png"
        ),
        "homepage_output": Path(
            "public/assets/products/homepage-cutouts/essential-oil-lemongrass-malaya-10ml-cutout-v6.png"
        ),
        "detail_reference": Path(
            "public/assets/products/product-detail-cutouts/essential-oil-lemongrass-malaya-10ml-detail-v1.png"
        ),
        "detail_seed": Path(
            "public/assets/products/product-detail-cutouts/essential-oil-lemongrass-malaya-10ml-detail-v1.png"
        ),
        "detail_output": Path(
            "public/assets/products/product-detail-cutouts/essential-oil-lemongrass-malaya-10ml-detail-v4.png"
        ),
        "fit_mode": "height",
        "use_envelope_cleanup": False,
    },
}


def alpha_bbox(alpha: np.ndarray, threshold: int = 1) -> np.ndarray:
    ys, xs = np.where(alpha >= threshold)
    return np.array([xs.min(), ys.min(), xs.max(), ys.max()], dtype=np.float32)


def largest_component(mask: np.ndarray) -> np.ndarray:
    labels, count = ndimage.label(mask)
    if not count:
        return mask
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    return labels == areas.argmax()


def estimate_background(rgb: np.ndarray) -> np.ndarray:
    height, width, _ = rgb.shape
    pad = max(24, min(height, width) // 18)
    corner_patches = [
        rgb[:pad, :pad],
        rgb[:pad, -pad:],
        rgb[-pad:, :pad],
        rgb[-pad:, -pad:],
    ]
    return np.median(
        np.concatenate([patch.reshape(-1, 3) for patch in corner_patches], axis=0),
        axis=0,
    ).astype(np.float32)


def build_clean_cutout(source_path: Path, use_envelope_cleanup: bool, session) -> np.ndarray:
    rgb = np.array(Image.open(source_path).convert("RGB"))
    background = estimate_background(rgb)
    distance_from_background = np.max(
        np.abs(rgb.astype(np.float32) - background),
        axis=2,
    )

    rembg_rgba = np.array(
        Image.open(
            io.BytesIO(remove(source_path.read_bytes(), session=session, post_process_mask=True))
        ).convert("RGBA")
    )
    base_mask = rembg_rgba[:, :, 3] > 0

    grabcut_mask = np.full(base_mask.shape, cv2.GC_PR_BGD, dtype=np.uint8)
    grabcut_mask[base_mask] = cv2.GC_PR_FGD

    sure_background = np.zeros(base_mask.shape, dtype=bool)
    sure_background[:24, :] = True
    sure_background[-24:, :] = True
    sure_background[:, :24] = True
    sure_background[:, -24:] = True
    sure_background |= ~cv2.dilate(
        base_mask.astype(np.uint8),
        np.ones((5, 5), np.uint8),
        iterations=1,
    ).astype(bool)

    core_threshold = max(28.0, float(np.quantile(distance_from_background[base_mask], 0.65)))
    sure_foreground = cv2.erode(
        base_mask.astype(np.uint8),
        np.ones((9, 9), np.uint8),
        iterations=2,
    ).astype(bool)
    sure_foreground |= distance_from_background > core_threshold
    sure_foreground &= base_mask
    sure_foreground = largest_component(sure_foreground)

    grabcut_mask[sure_background] = cv2.GC_BGD
    grabcut_mask[sure_foreground] = cv2.GC_FGD
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(
        rgb,
        grabcut_mask,
        None,
        background_model,
        foreground_model,
        6,
        cv2.GC_INIT_WITH_MASK,
    )

    foreground_mask = np.isin(grabcut_mask, [cv2.GC_FGD, cv2.GC_PR_FGD])
    foreground_mask = largest_component(foreground_mask)

    if use_envelope_cleanup:
        object_core = foreground_mask & (
            distance_from_background
            > max(20.0, float(np.quantile(distance_from_background[foreground_mask], 0.2)))
        )
        object_core = cv2.erode(
            object_core.astype(np.uint8),
            np.ones((3, 3), np.uint8),
            iterations=1,
        ).astype(bool)
        object_core = largest_component(object_core)

        height, width = foreground_mask.shape
        yy, xx = np.indices((height, width))
        allowed_region = np.ones_like(foreground_mask, dtype=bool)

        valid_columns = np.where(object_core.any(axis=0))[0]
        if valid_columns.size:
            bottom_edge = np.full(width, np.nan)
            bottom_edge[valid_columns] = [
                np.where(object_core[:, column])[0].max() for column in valid_columns
            ]
            valid = np.where(~np.isnan(bottom_edge))[0]
            bottom_curve = gaussian_filter1d(
                np.interp(np.arange(width), valid, bottom_edge[valid]),
                sigma=5,
            )
            allowed_region &= yy <= bottom_curve[None, :] + 24

        valid_rows = np.where(object_core.any(axis=1))[0]
        if valid_rows.size:
            left_edge = np.full(height, np.nan)
            right_edge = np.full(height, np.nan)
            left_edge[valid_rows] = [
                np.where(object_core[row])[0].min() for row in valid_rows
            ]
            right_edge[valid_rows] = [
                np.where(object_core[row])[0].max() for row in valid_rows
            ]
            valid = np.where(~np.isnan(left_edge))[0]
            left_curve = gaussian_filter1d(
                np.interp(np.arange(height), valid, left_edge[valid]),
                sigma=4,
            )
            right_curve = gaussian_filter1d(
                np.interp(np.arange(height), valid, right_edge[valid]),
                sigma=4,
            )
            allowed_region &= xx >= left_curve[:, None] - 22
            allowed_region &= xx <= right_curve[:, None] + 22

        foreground_mask &= allowed_region
        foreground_mask = largest_component(foreground_mask)

    support_mask = cv2.dilate(
        foreground_mask.astype(np.uint8),
        np.ones((3, 3), np.uint8),
        iterations=1,
    ).astype(bool)
    alpha = cv2.GaussianBlur(foreground_mask.astype(np.float32), (0, 0), 0.7)
    alpha *= support_mask.astype(np.float32)
    alpha[alpha < 0.015] = 0.0
    alpha = np.clip(alpha, 0.0, 1.0)

    alpha_safe = np.maximum(alpha, 1e-3)[..., None]
    foreground = (
        rgb.astype(np.float32) - (1.0 - alpha[..., None]) * background[None, None, :]
    ) / alpha_safe
    foreground = np.clip(foreground, 0, 255).astype(np.uint8)

    return np.dstack([foreground, (alpha * 255).astype(np.uint8)])


def normalize_to_reference(
    master_rgba: np.ndarray,
    reference_path: Path,
    output_path: Path,
    fit_mode: str,
) -> None:
    reference_rgba = np.array(Image.open(reference_path).convert("RGBA"))
    reference_alpha = reference_rgba[:, :, 3]
    target_bbox = alpha_bbox(reference_alpha, threshold=REFERENCE_ALPHA_THRESHOLD)

    master_bbox = alpha_bbox(master_rgba[:, :, 3], threshold=1)
    master_crop = master_rgba[
        int(master_bbox[1]) : int(master_bbox[3]) + 1,
        int(master_bbox[0]) : int(master_bbox[2]) + 1,
    ]
    crop_height, crop_width = master_crop.shape[:2]
    target_width = float(target_bbox[2] - target_bbox[0] + 1)
    target_height = float(target_bbox[3] - target_bbox[1] + 1)

    if fit_mode == "height":
        scale = target_height / crop_height
    elif fit_mode == "width":
        scale = target_width / crop_width
    else:
        scale = min(target_width / crop_width, target_height / crop_height)

    resized = Image.fromarray(master_crop).resize(
        (
            max(1, round(crop_width * scale)),
            max(1, round(crop_height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    resized_rgba = np.array(resized)
    resized_height, resized_width = resized_rgba.shape[:2]

    canvas_height, canvas_width = reference_alpha.shape
    target_center_x = (target_bbox[0] + target_bbox[2]) / 2.0
    target_center_y = (target_bbox[1] + target_bbox[3]) / 2.0
    x0 = int(round(target_center_x - resized_width / 2.0))
    y0 = int(round(target_center_y - resized_height / 2.0))

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

    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(canvas).save(output_path)


def decontaminate_against_white(seed_path: Path, output_path: Path) -> None:
    rgba = np.array(Image.open(seed_path).convert("RGBA")).astype(np.float32)
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3] / 255.0
    background = np.array([255.0, 255.0, 255.0], dtype=np.float32)
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
    output_rgba = np.dstack([foreground, alpha[..., None] * 255]).astype(np.uint8)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(output_rgba).save(output_path)


def main() -> None:
    session = new_session("u2net")

    for slug, config in PRODUCTS.items():
        source_path = config["source"]
        master_path = config["master"]
        homepage_reference = config["homepage_reference"]
        homepage_output = config["homepage_output"]
        detail_reference = config["detail_reference"]
        detail_output = config["detail_output"]
        fit_mode = str(config["fit_mode"])
        use_envelope_cleanup = bool(config["use_envelope_cleanup"])

        if "master_seed" in config and "homepage_seed" in config and "detail_seed" in config:
            decontaminate_against_white(config["master_seed"], master_path)
            decontaminate_against_white(config["homepage_seed"], homepage_output)
            decontaminate_against_white(config["detail_seed"], detail_output)
            print(f"rebuilt {slug}")
            continue

        master_rgba = build_clean_cutout(source_path, use_envelope_cleanup, session)
        master_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(master_rgba).save(master_path)
        normalize_to_reference(master_rgba, homepage_reference, homepage_output, fit_mode)
        normalize_to_reference(master_rgba, detail_reference, detail_output, fit_mode)
        print(f"rebuilt {slug}")


if __name__ == "__main__":
    main()
