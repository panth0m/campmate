#!/usr/bin/env python3
import json, re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "products_source.json"
TARGET = ROOT / "data" / "products.json"

DEFAULT_STORES = [
    ("eBay AU", "https://www.ebay.com.au/sch/i.html?_nkw={q}", "search"),
    ("Amazon AU", "https://www.amazon.com.au/s?k={q}&tag=campmateau20-22", "search"),
    ("BCF", "https://www.bcf.com.au/search?q={q}", "search"),
    ("Anaconda", "https://www.anacondastores.com/search?text={q}", "search"),
    ("Snowys", "https://www.snowys.com.au/search?q={q}", "search"),
    ("Tentworld", "https://www.tentworld.com.au/Search.aspx?q={q}", "search"),
    ("Wild Earth", "https://www.wildearth.com.au/search?type=product&q={q}", "search"),
]

CAT_LABELS = {
    "tents": "Camping Tents",
    "chairs": "Camping Chairs",
    "coolers": "Coolers & Ice Boxes",
    "stoves": "Camping Stoves",
    "lanterns": "Camping Lanterns",
    "sleep-systems": "Sleeping Bags & Mats",
}

CATEGORY_SINGULAR = {
    "tents": "tent",
    "chairs": "chair",
    "coolers": "cooler",
    "stoves": "stove",
    "lanterns": "lantern",
    "sleep-systems": "sleep system",
}

BRAND_MAP = {
    "blackwolf": "BlackWolf",
    "oztrail": "OZtrail",
    "msr": "MSR",
    "darche": "Darche",
    "hilleberg": "Hilleberg",
    "naturehike": "Naturehike",
    "sea to summit": "Sea to Summit",
    "snow peak": "Snow Peak",
    "big agnes": "Big Agnes",
    "jetboil": "Jetboil",
}


def slugify(text: str) -> str:
    value = ''.join(ch.lower() if ch.isalnum() else '-' for ch in str(text))
    while '--' in value:
        value = value.replace('--', '-')
    return value.strip('-') or 'product'


def default_image(category: str) -> str:
    return f"assets/images/categories/{category or 'tents'}.svg"


def default_stores(name: str):
    q = quote(name)
    return [{"name": label, "url": url.format(q=q), "type": kind} for label, url, kind in DEFAULT_STORES]


def normalize_brand(brand: str) -> str:
    raw = str(brand or '').strip()
    if not raw:
        return 'CampMate'
    return BRAND_MAP.get(raw.lower(), raw)


def normalize_name(name: str, raw_brand: str, normalized_brand: str) -> str:
    value = str(name or 'Product').strip()
    if raw_brand and normalized_brand and value.lower().startswith(str(raw_brand).lower()):
        return normalized_brand + value[len(str(raw_brand)): ]
    return value


def clean_description(text: str, category: str = '', raw_brand: str = '', normalized_brand: str = '') -> str:
    raw = re.sub(r'\s+', ' ', str(text or '').strip())
    singular = CATEGORY_SINGULAR.get(category or '', '')
    if singular:
        raw = re.sub(r'\bis\s+a\s+(premium|mid-range|high-end|budget)\s+[a-z\- ]+?\s+from\b', lambda m: f'is a {m.group(1)} {singular} from', raw, flags=re.I)
        raw = re.sub(rf'(premium|mid-range|high-end|budget)\s+{re.escape(category)}\b', rf'\1 {singular}', raw, flags=re.I)
        raw = re.sub(rf'\b{re.escape(category)}\s+from\b', f'{singular} from', raw, flags=re.I)
    replacements = {
        'premium sleep systems': 'premium sleep system',
        'premium sleep-systems': 'premium sleep system',
        'mid-range sleep systems': 'mid-range sleep system',
        'high-end sleep systems': 'high-end sleep system',
        'budget sleep systems': 'budget sleep system',
    }
    for old, new in replacements.items():
        raw = re.sub(old, new, raw, flags=re.I)
    if raw_brand and normalized_brand and raw_brand != normalized_brand:
        raw = re.sub(re.escape(raw_brand), normalized_brand, raw, flags=re.I)
    raw = raw.replace('This Prod...', '').strip()
    raw = raw.replace('This Prod..', '').strip()
    return raw


def clean_highlights(items):
    cleaned = []
    seen = set()
    for item in items or []:
        item = str(item or '').strip()
        low = item.lower()
        if not item or item == '00-person capacity' or re.search(r'(?i)capacity:\s*00\s*person|\b00[- ]?person\b|\b0[- ]?person\b', item):
            continue
        if low in {'by blackwolf', 'by black wolf'}:
            continue
        if low.endswith(' option') or low.endswith(' options'):
            continue
        if '...' in item or len(item) > 42:
            continue
        if item not in seen:
            seen.add(item)
            cleaned.append(item)
    return cleaned


def normalize_specs(specs: dict) -> dict:
    cleaned = {}
    for key, value in (specs or {}).items():
        skey = str(key or '').strip()
        sval = str(value or '').strip()
        if not skey or not sval:
            continue
        low = sval.lower()
        if low in {'00 person', '0 person', '00-person', '0-person', '0p', '00p'} or re.search(r'(?i)^capacity:\s*00\s*person$', sval):
            continue
        if skey.lower() == 'capacity' and re.fullmatch(r'0+\s*(person|p)', low):
            continue
        cleaned[skey] = sval
    return cleaned


def normalize_product(product: dict, index: int) -> dict:
    raw_brand = product.get("brand", "CampMate")
    brand = normalize_brand(raw_brand)
    name = normalize_name(product.get("name", "Product"), raw_brand, brand)
    category = product.get("category", "tents")
    stores = product.get("stores") or default_stores(name)
    price = int(product.get("price", 0) or 0)
    sale_price = int(product.get("salePrice", price) or price)
    rating = float(product.get("rating", 4.2) or 4.2)
    reviews = int(product.get("reviews", 0) or 0)
    image = product.get("ebayImage") or product.get("image") or default_image(category)
    slug = product.get("slug") or slugify(f"{name}-{index}")
    return {
        "slug": slug,
        "name": name,
        "brand": brand,
        "category": category,
        "price": price,
        "salePrice": sale_price,
        "rating": rating,
        "reviews": reviews,
        "image": image,
        "ebayImage": product.get("ebayImage"),
        "summary": product.get("summary", "Affiliate-ready compare page for Australian camping shoppers."),
        "stores": stores,
        "categoryName": CAT_LABELS.get(category, category.replace('-', ' ').title()),
        "highlights": clean_highlights(product.get("highlights") or []),
        "description": clean_description(product.get("description") or product.get("summary") or "", category, raw_brand, brand),
        "specs": normalize_specs(product.get("specs") or {}),
    }


def main():
    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    normalized = [normalize_product(product, i + 1) for i, product in enumerate(products)]
    TARGET.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(normalized)} products to {TARGET}")


if __name__ == "__main__":
    main()
