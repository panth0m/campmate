import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "products_source.json"
TARGET = ROOT / "data" / "products.json"

DEFAULT_STORES = [
    ("eBay AU", "https://www.ebay.com.au/sch/i.html?_nkw={q}", "search"),
    ("Amazon AU", "https://www.amazon.com.au/s?k={q}", "search"),
    ("BCF", "https://www.bcf.com.au/search?q={q}", "search"),
    ("Anaconda", "https://www.anacondastores.com/search?text={q}", "search"),
    ("Snowys", "https://www.snowys.com.au/search?q={q}", "search"),
    ("Tentworld", "https://www.tentworld.com.au/Search.aspx?q={q}", "search"),
    ("Wild Earth", "https://www.wildearth.com.au/search?type=product&q={q}", "search"),
]


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


def normalize_product(product: dict, index: int) -> dict:
    name = product.get("name", "Product")
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
        "brand": product.get("brand", "CampMate"),
        "category": category,
        "price": price,
        "salePrice": sale_price,
        "rating": rating,
        "reviews": reviews,
        "image": image,
        "ebayImage": product.get("ebayImage"),
        "summary": product.get("summary", "Affiliate-ready compare page for Australian camping shoppers."),
        "stores": stores,
    }


def main():
    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    normalized = [normalize_product(product, i + 1) for i, product in enumerate(products)]
    TARGET.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(normalized)} products to {TARGET}")


if __name__ == "__main__":
    main()
