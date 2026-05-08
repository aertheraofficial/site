#!/usr/bin/env python3
from __future__ import annotations

import csv
import html
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = Path(
    "/Users/joseph/Downloads/FINAL DRAFT PRODUCTS ;- - 27+4 ( ready packaging and material ).csv"
)
CATALOG_PATH = ROOT / "content" / "catalog.json"
PRODUCT_ASSET_DIR = ROOT / "public" / "assets" / "products" / "catalog"

SESSION = requests.Session()


ACCENTS = {
    "Lemongrass Malaya": "#c4b062",
    "Pineapple Tropical": "#e0ab55",
    "Sleep Calm": "#8f96c9",
    "Soft Aura": "#c9a8b9",
    "Energy Shield": "#d29d64",
    "Golden Bloom": "#d8bc61",
    "Floral Balance": "#b78ebc",
    "Serene Space": "#87a7b0",
    "Stress Relief": "#8cab7d",
    "Jade Tea": "#8aa47b",
    "Happy": "#e8b357",
    "Rose": "#c98b97",
    "Pink Chiffon": "#d8a9b8",
}

SCENT_NOTES = {
    "Lemongrass Malaya": ["lemongrass", "green citrus", "sunlit stem"],
    "Pineapple Tropical": ["pineapple rind", "bright fruit", "soft green sugar"],
    "Sleep Calm": ["lavender hush", "powdered herbal", "night air"],
    "Soft Aura": ["clean petals", "sheer musk", "quiet warmth"],
    "Energy Shield": ["citrus peel", "warm spice", "dry herbal edge"],
    "Golden Bloom": ["soft florals", "golden resin", "warm light"],
    "Floral Balance": ["petal accord", "fresh leaves", "calm sweetness"],
    "Serene Space": ["clean wood", "cool air", "subtle herbal clarity"],
    "Stress Relief": ["minted herbs", "fresh citrus", "cool calm"],
    "Jade Tea": ["green tea", "fresh leaves", "soft steam"],
    "Happy": ["bright citrus", "soft fruit", "sunny florals"],
    "Rose": ["rose petals", "velvet floral", "warm powder"],
    "Pink Chiffon": ["soft florals", "clean musk", "powdered sweetness"],
}

CRAFTED_FOR = {
    "Body Cleanse Shower Gel": "Daily shower ritual",
    "Body Cleanse Shower Oil": "Nourishing shower ritual",
    "Calm Mousseline": "Fabric and room refresh",
    "Body Oil": "After-shower body care",
    "Hair Root Serum": "Scalp and root treatment",
    "Reed Diffuser": "All-day room scent",
    "Scented Candle": "Evening ambiance",
    "Essential Oil": "Diffusion and aromatherapy",
    "Essential Oil Blend": "Targeted wellness ritual",
    "Scented Spray": "Portable room refresh",
    "Roll On Essential Oil": "On-the-go pulse point ritual",
    "Scented Oil": "Home scenting and diffuser use",
}

FORMAT_DESCRIPTORS = {
    "Body Cleanse Shower Gel": "a cleansing gel format for everyday use",
    "Body Cleanse Shower Oil": "a richer shower oil format for a softer cleanse",
    "Calm Mousseline": "a soft mist format for linens, fabric, and air",
    "Body Oil": "a nourishing body oil for post-shower care",
    "Hair Root Serum": "a focused serum format designed for scalp care",
    "Reed Diffuser": "a long-form home fragrance object",
    "Scented Candle": "a candle format built for slower evening use",
    "Essential Oil": "a concentrated aromatherapy oil",
    "Essential Oil Blend": "a layered essential oil blend",
    "Scented Spray": "an easy room and fabric spray",
    "Roll On Essential Oil": "a portable pulse-point oil",
    "Scented Oil": "a compact scented oil format",
}

RITUALS = {
    "Body Cleanse Shower Gel": [
        "Use as the opening step in the shower to bring the scent collection onto skin.",
        "Rinse fully and layer with a body or home format from the same scent family.",
        "Keep it near the sink or bath for the most direct daily-use ritual.",
    ],
    "Body Cleanse Shower Oil": [
        "Massage onto damp skin when you want a softer, more conditioning cleanse.",
        "Rinse lightly so the scent remains closer to the body after the shower.",
        "Pair it with the matching body oil or diffuser to extend the ritual.",
    ],
    "Calm Mousseline": [
        "Mist onto linens, curtains, or fabric surfaces from a short distance.",
        "Let the scent settle for a moment before the textile is in direct contact with skin.",
        "Use between deeper room-scent rituals when you want a lighter refresh.",
    ],
    "Body Oil": [
        "Apply to towel-dried skin after bathing while the body is still slightly warm.",
        "Work it over arms, shoulders, and collarbone so the scent develops gently.",
        "Use a smaller amount when layering with another product from the same collection.",
    ],
    "Hair Root Serum": [
        "Apply directly to the scalp or root area with a light hand.",
        "Massage in slowly to turn the treatment into a calm, focused ritual.",
        "Use between wash days or before rest depending on your routine.",
    ],
    "Reed Diffuser": [
        "Place it where air moves naturally so the scent can carry through the room.",
        "Turn the reeds periodically when you want a fresher lift in the space.",
        "Use it as the anchor object, then layer with sprays or oils as needed.",
    ],
    "Scented Candle": [
        "Trim the wick and allow the wax pool to even out on the first burn.",
        "Use it when you want the scent to feel slower, warmer, and more atmospheric.",
        "Pair it with the matching diffuser or spray for a fuller room story.",
    ],
    "Essential Oil": [
        "Diffuse a few drops when you want the purest expression of the scent.",
        "Use sparingly in a personal ritual or in a room-focused aromatherapy setup.",
        "Keep the bottle sealed between uses so the profile stays sharp and bright.",
    ],
    "Essential Oil Blend": [
        "Diffuse or dilute according to your preferred aromatherapy ritual.",
        "Use when you want a more functional mood-led profile than a single-note oil.",
        "Reach for it at the start or end of the day depending on the blend direction.",
    ],
    "Scented Spray": [
        "Mist lightly into the room, onto linens, or around soft furnishings.",
        "Use it for a quick reset when a diffuser or candle feels too permanent.",
        "Keep it nearby for travel, work, or a mid-day atmosphere change.",
    ],
    "Roll On Essential Oil": [
        "Apply to pulse points such as wrists, temples, or the back of the neck.",
        "Roll on lightly and let the scent warm naturally on skin.",
        "Use it as the most portable version of the aromatherapy ritual.",
    ],
    "Scented Oil": [
        "Use with your preferred diffuser or scenting method in small amounts.",
        "Build the room gradually rather than overloading the fragrance at once.",
        "Pair it with a matching spray or candle if you want more presence.",
    ],
}

@dataclass(frozen=True)
class ColumnMap:
    number: int
    department: int
    category: int
    scent: int
    capacity: int
    photo: int
    label: int
    price: int
    inventory: int
    sku: int | None


@dataclass
class SourceRow:
    number: str
    department: str
    category: str
    scent: str
    capacity: str
    photo_url: str
    label_url: str
    price: int
    inventory: str
    sku: str


def title_case(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).title()


def clean_category(value: str) -> str:
    value = value.replace(";-", " ")
    value = value.replace(";", " ")
    value = value.replace("  ", " ")
    value = value.replace("ROLL ON", "Roll On")
    return title_case(value)


def clean_department(value: str) -> str:
    if value.upper() == "AROMATHERAPHY":
        return "Aromatherapy"
    return title_case(value)


def normalize_capacity(value: str) -> str:
    compact = re.sub(r"\s+", "", value.upper())
    compact = compact.replace("ML", "ml").replace("LITER", " liter")
    return compact


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def parse_price(value: str) -> int:
    digits = value.replace("RM", "").replace(",", "").strip()
    return int(float(digits))


def extract_drive_id(url: str) -> str | None:
    match = re.search(r"/d/([^/]+)", url)
    return match.group(1) if match else None


def download_drive_file(file_id: str, destination: Path) -> Path:
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    response = SESSION.get(download_url, allow_redirects=True, timeout=60)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    extension = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
    }.get(content_type, destination.suffix or ".bin")

    output_path = destination.with_suffix(extension)
    output_path.write_bytes(response.content)
    return output_path


def write_placeholder_svg(destination: Path, product_name: str, accent: str) -> Path:
    title = html.escape(product_name)
    accent_light = f"{accent}33"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000" fill="none">
  <rect width="1600" height="2000" rx="84" fill="#F6F1E8"/>
  <rect x="84" y="84" width="1432" height="1832" rx="72" fill="#FFFDF9" stroke="#E7DDCF" stroke-width="6"/>
  <ellipse cx="800" cy="600" rx="360" ry="360" fill="{accent_light}"/>
  <path d="M800 462c-73 0-132 59-132 132v110h264V594c0-73-59-132-132-132Z" fill="{accent}" fill-opacity=".16" stroke="{accent}" stroke-width="24"/>
  <rect x="560" y="704" width="480" height="568" rx="78" fill="{accent}" fill-opacity=".08" stroke="{accent}" stroke-width="24"/>
  <rect x="596" y="748" width="408" height="492" rx="54" fill="#FCF8F1" stroke="#E7DDCF" stroke-width="10"/>
  <text x="800" y="1400" text-anchor="middle" fill="#8D7A5C" font-family="Georgia, 'Times New Roman', serif" font-size="44" letter-spacing="7">PACKSHOT IN PREPARATION</text>
  <foreignObject x="250" y="1465" width="1100" height="260">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;height:100%;align-items:flex-start;justify-content:center;text-align:center;color:#201D17;font-size:76px;line-height:1.08;font-family:Georgia,'Times New Roman',serif;padding:0 20px;">
      <div>{title}</div>
    </div>
  </foreignObject>
</svg>
"""
    output_path = destination.with_suffix(".svg")
    output_path.write_text(svg, encoding="utf-8")
    return output_path


def build_excerpt(category_label: str, scent: str, capacity: str) -> str:
    descriptor = FORMAT_DESCRIPTORS[category_label]
    return f"{title_case(scent)} in {capacity} as {descriptor}."


def build_description(row: SourceRow, category_label: str, availability: str) -> str:
    descriptor = FORMAT_DESCRIPTORS[category_label]
    stock_note = (
        "The current stock note indicates ready inventory."
        if availability == "In stock"
        else "The current stock note indicates a smaller or made-to-order run."
    )
    return (
        f"This product brings the {row.scent} scent profile into {descriptor}. "
        f"It is listed in the latest product draft under {row.department}, with a {row.capacity} fill size. {stock_note}"
    )


def build_related_slugs(
    rows: list[dict[str, Any]],
    source_by_slug: dict[str, SourceRow],
    current_slug: str,
    scent: str,
    category_label: str,
) -> list[str]:
    same_scent = [
        row["slug"]
        for row in rows
        if row["slug"] != current_slug and source_by_slug[row["slug"]].scent == scent
    ]
    same_category = [
        row["slug"]
        for row in rows
        if row["slug"] != current_slug and row["categoryLabel"] == category_label and row["slug"] not in same_scent
    ]
    return (same_scent + same_category)[:3]


def normalize_header_cell(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def find_first_column(keys: list[str], *fragments: str) -> int | None:
    for index, key in enumerate(keys):
        if all(fragment.upper() in key for fragment in fragments):
            return index
    return None


def find_number_column(keys: list[str]) -> int | None:
    for index, key in enumerate(keys):
        base = key.rstrip(".")
        if base == "NO" or key.startswith("NO"):
            return index
    return None


def find_sku_column(keys: list[str]) -> int | None:
    for index, key in enumerate(keys):
        if "UPDATE" in key and "SKU" in key:
            return index
    for index, key in enumerate(keys):
        if key in {"SKU", "SKU CODE", "ITEM SKU"}:
            return index
    for index, key in enumerate(keys):
        if "SKU" in key:
            return index
    return None


def build_column_map(header: list[str]) -> ColumnMap:
    keys = [normalize_header_cell(cell) for cell in header]
    legacy = ColumnMap(0, 1, 2, 3, 4, 5, 7, 8, 9, None)

    number = find_number_column(keys)
    department = find_first_column(keys, "DEPARTMENT")
    category = find_first_column(keys, "CATEGORY")
    scent = find_first_column(keys, "SCENTS", "COLLECTION") or find_first_column(keys, "SCENT", "COLLECTION")
    capacity = find_first_column(keys, "CAPACITY")
    photo = find_first_column(keys, "LINK", "PHOTO")
    label = find_first_column(keys, "LINK", "LABEL")
    price = find_first_column(keys, "PRICE", "RETAIL") or find_first_column(keys, "PRICE", "ECOMMERCE")
    inventory = find_first_column(keys, "INVENTORY", "COUNT")
    sku = find_sku_column(keys)

    return ColumnMap(
        number=number if number is not None else legacy.number,
        department=department if department is not None else legacy.department,
        category=category if category is not None else legacy.category,
        scent=scent if scent is not None else legacy.scent,
        capacity=capacity if capacity is not None else legacy.capacity,
        photo=photo if photo is not None else legacy.photo,
        label=label if label is not None else legacy.label,
        price=price if price is not None else legacy.price,
        inventory=inventory if inventory is not None else legacy.inventory,
        sku=sku,
    )


def cell_at(row: list[str], column: int) -> str:
    if column < 0 or column >= len(row):
        return ""
    return row[column]


def parse_rows() -> list[SourceRow]:
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as csv_file:
        rows = list(csv.reader(csv_file))

    header = rows[1]
    cols = build_column_map(header)
    source_rows: list[SourceRow] = []

    for row in rows[2:]:
        row += [""] * (len(header) - len(row))
        number = cell_at(row, cols.number).strip()
        category = cell_at(row, cols.category).strip()

        if not re.match(r"^\d+\*?$", number) or not category:
            continue

        sku_raw = cell_at(row, cols.sku).strip() if cols.sku is not None else ""
        sku_clean = re.sub(r"\s+", " ", sku_raw)

        source_rows.append(
            SourceRow(
                number=number,
                department=clean_department(cell_at(row, cols.department).strip()),
                category=clean_category(category),
                scent=title_case(cell_at(row, cols.scent).strip()),
                capacity=normalize_capacity(cell_at(row, cols.capacity).strip()),
                photo_url=cell_at(row, cols.photo).strip(),
                label_url=cell_at(row, cols.label).strip(),
                price=parse_price(cell_at(row, cols.price).strip()),
                inventory=re.sub(r"\s+", " ", cell_at(row, cols.inventory).strip()),
                sku=sku_clean,
            )
        )

    return source_rows


def build_catalog() -> dict[str, Any]:
    PRODUCT_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    rows = parse_rows()
    products: list[dict[str, Any]] = []
    source_by_slug: dict[str, SourceRow] = {}

    for row in rows:
        base_slug = slugify(f"{row.category} {row.scent} {row.capacity}")
        slug = base_slug

        if slug == "essential-oil-lemongrass-malaya-10ml":
            slug = "essential-oil-lemongrass-malaya-10ml"

        accent = ACCENTS.get(row.scent, "#bda98a")
        availability = "Pre-order" if ("sample" in row.inventory.lower() or row.inventory.upper() == "NA") else "In stock"
        lead_time = "7-14 working days" if availability == "Pre-order" else None

        destination = PRODUCT_ASSET_DIR / slug
        if row.photo_url:
            file_id = extract_drive_id(row.photo_url)
            if not file_id:
                raise RuntimeError(f"Could not parse Google Drive id from {row.photo_url}")
            image_path = download_drive_file(file_id, destination)
        else:
            image_path = write_placeholder_svg(destination, f"{row.category} {row.scent}", accent)

        image_public_path = "/" + image_path.relative_to(ROOT / "public").as_posix()
        category_slugs = ["all-products", slugify(row.department)]
        if row.scent == "Lemongrass Malaya":
            category_slugs.append("lemongrass-collection")
        elif row.scent == "Pineapple Tropical":
            category_slugs.append("pineapple-collection")

        details = [
            {"label": "Department", "value": row.department},
            {"label": "Collection", "value": row.scent},
            {"label": "Size", "value": row.capacity},
            {"label": "Inventory", "value": row.inventory or "Not specified"},
            {"label": "Status", "value": availability},
            {"label": "Crafted for", "value": CRAFTED_FOR[row.category]},
        ]

        if row.sku:
            details.insert(3, {"label": "SKU", "value": row.sku})

        if lead_time:
            details.insert(5 + (1 if row.sku else 0), {"label": "Lead time", "value": lead_time})

        products.append(
            {
                "id": slug,
                "slug": slug,
                "name": f"{row.category} {row.scent} {row.capacity}",
                "shortName": row.category,
                "categoryLabel": row.category,
                "categorySlugs": category_slugs,
                "size": row.capacity,
                "price": row.price,
                **({"sku": row.sku} if row.sku else {}),
                "availability": availability,
                **({"leadTime": lead_time} if lead_time else {}),
                "excerpt": build_excerpt(row.category, row.scent, row.capacity),
                "description": build_description(row, row.category, availability),
                "scentNotes": SCENT_NOTES.get(row.scent, [row.scent.lower()]),
                "ritual": RITUALS[row.category],
                "details": details,
                "image": image_public_path,
                "gallery": [image_public_path],
                "accent": accent,
                "relatedSlugs": [],
            }
        )
        source_by_slug[slug] = row

    for product in products:
        product["relatedSlugs"] = build_related_slugs(
            products,
            source_by_slug,
            product["slug"],
            source_by_slug[product["slug"]].scent,
            product["categoryLabel"],
        )

    return {"products": products}


def main() -> None:
    catalog = build_catalog()
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(catalog['products'])} products to {CATALOG_PATH}")


if __name__ == "__main__":
    main()
