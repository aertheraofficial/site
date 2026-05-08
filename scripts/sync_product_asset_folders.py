#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content/catalog.json"
MAIN_DIR = ROOT / "public/assets/products/main"

# Extra cutouts referenced by `src/lib/product-images.ts` overrides (not derivable from catalog paths alone).
EXTRA_MAIN_FILENAMES = frozenset(
    {
        "body-cleanse-shower-oil-lemongrass-malaya-230ml-20260422.png",
        "body-cleanse-shower-oil-pineapple-tropical-230ml-20260422.png",
    }
)


def get_expected_filenames() -> set[str]:
    catalog = json.loads(CATALOG_PATH.read_text())
    expected = {
        f'{product["slug"]}{Path(product["image"]).suffix.lower()}'
        for product in catalog["products"]
    }
    return expected | set(EXTRA_MAIN_FILENAMES)


def sync_directory(path: Path, expected_filenames: set[str]) -> None:
    path.mkdir(parents=True, exist_ok=True)

    for file_path in path.iterdir():
        if file_path.is_file() and file_path.name not in expected_filenames:
            file_path.unlink()
            print(f"removed {file_path.relative_to(ROOT)}")

    existing_filenames = {
        file_path.name for file_path in path.iterdir() if file_path.is_file()
    }
    missing_filenames = sorted(expected_filenames - existing_filenames)

    if missing_filenames:
        missing_list = ", ".join(missing_filenames)
        raise FileNotFoundError(
            f"Missing expected assets in {path.relative_to(ROOT)}: {missing_list}"
        )

    print(f"verified {path.relative_to(ROOT)} ({len(expected_filenames)} files)")


def main() -> None:
    expected_filenames = get_expected_filenames()
    sync_directory(MAIN_DIR, expected_filenames)


if __name__ == "__main__":
    main()
