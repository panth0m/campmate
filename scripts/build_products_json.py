import json
from pathlib import Path
from urllib.parse import quote

from catalog_rules import is_relevant_product, normalize_product_payload

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data' / 'products_source.json'
TARGET = ROOT / 'data' / 'products.json'

DEFAULT_STORES = [
    ('eBay AU', 'https://www.ebay.com.au/sch/i.html?_nkw={q}', 'search'),
    ('Amazon AU', 'https://www.amazon.com.au/s?k={q}', 'search'),
    ('BCF', 'https://www.bcf.com.au/search?q={q}', 'search'),
    ('Anaconda', 'https://www.anacondastores.com/search?text={q}', 'search'),
    ('Snowys', 'https://www.snowys.com.au/search?q={q}', 'search'),
    ('Tentworld', 'https://www.tentworld.com.au/Search.aspx?q={q}', 'search'),
    ('Wild Earth', 'https://www.wildearth.com.au/search?type=product&q={q}', 'search'),
]

CATEGORY_FALLBACKS = {
    'tents': 'assets/images/categories/tents.svg',
    'chairs': 'assets/images/categories/chairs.svg',
    'coolers': 'assets/images/categories/coolers.svg',
    'stoves': 'assets/images/categories/stoves.svg',
    'lanterns': 'assets/images/categories/lanterns.svg',
    'sleep-systems': 'assets/images/categories/sleep-systems.svg',
}


def slugify(text: str) -> str:
    value = ''.join(ch.lower() if ch.isalnum() else '-' for ch in str(text))
    while '--' in value:
        value = value.replace('--', '-')
    return value.strip('-') or 'product'


def default_image(category: str) -> str:
    return CATEGORY_FALLBACKS.get(category or 'tents', CATEGORY_FALLBACKS['tents'])


def default_stores(name: str):
    q = quote(name)
    return [{'name': label, 'url': url.format(q=q), 'type': kind} for label, url, kind in DEFAULT_STORES]


def normalize_product(product: dict, index: int) -> dict | None:
    category = product.get('category', 'tents')
    cleaned = normalize_product_payload(product, category)
    if not is_relevant_product(cleaned, category):
        return None
    name = cleaned.get('name', 'Product')
    stores = cleaned.get('stores') or default_stores(name)
    price = int(float(cleaned.get('price', 0) or 0))
    sale_price = int(float(cleaned.get('salePrice', price) or price))
    rating = float(cleaned.get('rating', 4.2) or 4.2)
    reviews = int(cleaned.get('reviews', 0) or 0)
    image = cleaned.get('ebayImage') or cleaned.get('image') or default_image(category)
    slug = cleaned.get('slug') or slugify(f'{name}-{index}')
    return {
        'slug': slug,
        'name': name,
        'brand': cleaned.get('brand', 'CampMate'),
        'category': category,
        'categoryName': cleaned.get('categoryName') or category.replace('-', ' ').title(),
        'price': price,
        'salePrice': sale_price,
        'rating': rating,
        'reviews': reviews,
        'image': image,
        'summary': cleaned.get('summary', 'Affiliate-ready compare page for Australian camping shoppers.'),
        'stores': stores,
        'source': cleaned.get('source'),
        'sourceItemId': cleaned.get('sourceItemId'),
        'sourceLegacyItemId': cleaned.get('sourceLegacyItemId'),
    }


def main():
    products = json.loads(SOURCE.read_text(encoding='utf-8')) if SOURCE.exists() else []
    normalized = []
    skipped = 0
    for i, product in enumerate(products, 1):
        item = normalize_product(product, i)
        if item is None:
            skipped += 1
            continue
        normalized.append(item)
    TARGET.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {len(normalized)} products to {TARGET} (skipped {skipped} junk items)')


if __name__ == '__main__':
    main()
