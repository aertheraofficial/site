#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content/catalog.json"
BACKUP_DIR = ROOT / "public/assets/products/original-backup"
MAIN_DIR = ROOT / "public/assets/products/main"


def get_expected_filenames() -> set[str]:
    catalog = json.loads(CATALOG_PATH.read_text())
    return {
        f'{product["slug"]}{Path(product["image"]).suffix.lower()}'
        for product in catalog["products"]
    }


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
    sync_directory(BACKUP_DIR, expected_filenames)
    sync_directory(MAIN_DIR, expected_filenames)


if __name__ == "__main__":
    main()
