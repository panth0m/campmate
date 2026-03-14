
import argparse
import base64
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SOURCE_FILE = DATA_DIR / "products_source.json"
TARGET_FILE = DATA_DIR / "products.json"
STATE_FILE = DATA_DIR / "ebay_incremental_state.json"
PRESET_FILE = DATA_DIR / "ebay_incremental_presets.json"
ENV_FILE = ROOT / ".env"
BUILD_SCRIPT = ROOT / "scripts" / "build_products_json.py"

SEARCH_ENDPOINT = "https://api.ebay.com/buy/browse/v1/item_summary/search"
GET_ITEM_ENDPOINT = "https://api.ebay.com/buy/browse/v1/item/{}"
TOKEN_ENDPOINT = "https://api.ebay.com/identity/v1/oauth2/token"
MARKETPLACE = "EBAY_AU"
CATEGORY_FALLBACKS = {
    "tents": "assets/images/categories/tents.svg",
    "chairs": "assets/images/categories/chairs.svg",
    "coolers": "assets/images/categories/coolers.svg",
    "stoves": "assets/images/categories/stoves.svg",
    "lanterns": "assets/images/categories/lanterns.svg",
    "sleep-systems": "assets/images/categories/sleep-systems.svg",
}
STORE_TEMPLATES = [
    ("Amazon AU", "https://www.amazon.com.au/s?k={q}", "search"),
    ("BCF", "https://www.bcf.com.au/search?q={q}", "search"),
    ("Anaconda", "https://www.anacondastores.com/search?text={q}", "search"),
    ("Snowys", "https://www.snowys.com.au/search?q={q}", "search"),
    ("Tentworld", "https://www.tentworld.com.au/Search.aspx?q={q}", "search"),
    ("Wild Earth", "https://www.wildearth.com.au/search?type=product&q={q}", "search"),
]
USER_AGENT = "CampMateIncrementalImporter/1.0"


def load_env() -> Dict[str, str]:
    env: Dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    for key in list(env.keys()):
        os.environ.setdefault(key, env[key])
    return env


def read_json(path: Path, default: Any):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, obj: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def slugify(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", str(text).lower())
    return value.strip("-") or "product"


def uniq_slug(base: str, existing: set) -> str:
    slug = slugify(base)
    candidate = slug
    i = 2
    while candidate in existing:
        candidate = f"{slug}-{i}"
        i += 1
    existing.add(candidate)
    return candidate


def request_json(url: str, *, method: str = "GET", headers: Optional[Dict[str, str]] = None, body: Optional[bytes] = None) -> Dict[str, Any]:
    req = Request(url, data=body, method=method)
    req.add_header("User-Agent", USER_AGENT)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        payload = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {e.code} for {url}\n{payload[:1000]}") from e
    except URLError as e:
        raise RuntimeError(f"Network error for {url}: {e}") from e


def get_access_token() -> str:
    client_id = os.getenv("EBAY_CLIENT_ID")
    client_secret = os.getenv("EBAY_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not found in environment or .env")
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    body = urlencode({
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope",
    }).encode("utf-8")
    data = request_json(
        TOKEN_ENDPOINT,
        method="POST",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body=body,
    )
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"Failed to get eBay token: {data}")
    return token


def ebay_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
        # Request affiliate URLs and shipping where possible.
        "X-EBAY-C-ENDUSERCTX": "affiliateCampaignId=<ePN>,affiliateReferenceId=campmate,contextualLocation=country=AU,zip=4000",
    }


def discover_items(token: str, *, brand: str, category: str, query: str, offset: int, limit: int) -> Dict[str, Any]:
    params = {
        "q": f'{brand} {query}',
        "filter": "buyingOptions:{FIXED_PRICE},conditions:{NEW},deliveryCountry:AU,itemLocationCountry:AU",
        "sort": "newlyListed",
        "limit": str(limit),
        "offset": str(offset),
    }
    url = f"{SEARCH_ENDPOINT}?{urlencode(params)}"
    return request_json(url, headers=ebay_headers(token))


def get_item_details(token: str, item_id: str) -> Dict[str, Any]:
    url = GET_ITEM_ENDPOINT.format(quote(item_id, safe=""))
    return request_json(url, headers=ebay_headers(token))


def load_catalog() -> List[Dict[str, Any]]:
    return read_json(SOURCE_FILE, [])


def default_stores(product_name: str, ebay_url: str) -> List[Dict[str, str]]:
    q = quote(product_name)
    stores = [{"name": "eBay AU", "url": ebay_url, "type": "listing"}]
    for name, url, stype in STORE_TEMPLATES:
        stores.append({"name": name, "url": url.format(q=q), "type": stype})
    return stores


def first_image(item: Dict[str, Any]) -> str:
    return (
        item.get("image", {}) or {}
    ).get("imageUrl") or CATEGORY_FALLBACKS.get(item.get("_campmate_category", "tents"), CATEGORY_FALLBACKS["tents"])


def marketing_price(item: Dict[str, Any]) -> Optional[float]:
    mp = item.get("marketingPrice") or {}
    op = mp.get("originalPrice") or {}
    try:
        return float(op.get("value"))
    except Exception:
        return None


def current_price(item: Dict[str, Any]) -> Optional[float]:
    price = item.get("price") or item.get("currentBidPrice") or {}
    try:
        return float(price.get("value"))
    except Exception:
        return None


def get_brand_from_item(item: Dict[str, Any], fallback: str) -> str:
    product = item.get("product") or {}
    for key in ("brand", "brandName"):
        if product.get(key):
            return str(product[key]).strip()
    localized = item.get("localizedAspects") or []
    for aspect in localized:
        if str(aspect.get("name", "")).lower() == "brand" and aspect.get("value"):
            return str(aspect["value"]).strip()
    return fallback


def review_fields(item: Dict[str, Any]) -> Dict[str, Any]:
    rr = item.get("primaryProductReviewRating") or {}
    out = {"rating": None, "reviews": None, "ratingSource": None}
    if rr.get("averageRating") is not None:
        try:
            out["rating"] = round(float(rr["averageRating"]), 1)
        except Exception:
            pass
    if rr.get("reviewCount") is not None:
        try:
            out["reviews"] = int(rr["reviewCount"])
        except Exception:
            pass
    if out["rating"] is not None or out["reviews"] is not None:
        out["ratingSource"] = "ebay_primaryProductReviewRating"
    return out


def cleaned_summary(item: Dict[str, Any], category: str) -> str:
    text = item.get("shortDescription") or item.get("subtitle") or item.get("title") or ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    if len(text) > 180:
        text = text[:177].rstrip() + "..."
    if not text:
        defaults = {
            "tents": "eBay AU listing imported for CampMate compare pages.",
            "chairs": "eBay AU camp chair listing imported for CampMate compare pages.",
            "coolers": "eBay AU cooler listing imported for CampMate compare pages.",
            "stoves": "eBay AU stove listing imported for CampMate compare pages.",
            "lanterns": "eBay AU lantern listing imported for CampMate compare pages.",
            "sleep-systems": "eBay AU sleep-system listing imported for CampMate compare pages.",
        }
        text = defaults.get(category, "eBay AU listing imported for CampMate compare pages.")
    return text


def should_skip(item: Dict[str, Any], brand: str, category: str, exclude_terms: List[str]) -> bool:
    title = f"{item.get('title','')} {item.get('shortDescription','')} {item.get('subtitle','')}".lower()
    if brand.lower() not in title:
        return True
    for term in exclude_terms:
        if term.lower() in title:
            return True
    # Basic category sanity checks.
    checks = {
        "tents": ["tent", "swag", "shelter"],
        "chairs": ["chair", "seat", "stool", "recliner"],
        "coolers": ["cooler", "ice box", "icebox", "fridge"],
        "stoves": ["stove", "burner", "cooker", "jetboil", "grill"],
        "lanterns": ["lantern", "light", "headlamp"],
        "sleep-systems": ["sleeping", "bag", "mat", "pad", "quilt", "stretcher", "cot"],
    }
    if not any(token in title for token in checks.get(category, [])):
        return True
    return False


def import_one(item: Dict[str, Any], *, category: str, category_name: str, fallback_brand: str, existing_slugs: set) -> Dict[str, Any]:
    brand = get_brand_from_item(item, fallback_brand)
    title = str(item.get("title") or "").strip() or f"{brand} {category_name}"
    price_now = current_price(item) or 0
    price_full = marketing_price(item) or price_now or 0
    reviews = review_fields(item)
    url = item.get("itemAffiliateWebUrl") or item.get("itemWebUrl") or f"https://www.ebay.com.au/sch/i.html?_nkw={quote(title)}"
    slug = uniq_slug(f"{brand}-{title}", existing_slugs)
    product = {
        "slug": slug,
        "name": title,
        "brand": brand,
        "category": category,
        "categoryName": category_name,
        "price": round(price_full) if price_full else round(price_now),
        "salePrice": round(price_now),
        "rating": reviews["rating"] if reviews["rating"] is not None else 4.2,
        "reviews": reviews["reviews"] if reviews["reviews"] is not None else 0,
        "ratingSource": reviews["ratingSource"] or "fallback_default",
        "image": first_image(item),
        "summary": cleaned_summary(item, category),
        "stores": default_stores(title, url),
        "source": "ebay",
        "sourceItemId": item.get("itemId") or item.get("legacyItemId"),
        "sourceLegacyItemId": item.get("legacyItemId"),
        "marketplace": item.get("listingMarketplaceId") or MARKETPLACE,
        "sourceUrl": url,
        "importedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return product


def merge_products(existing: List[Dict[str, Any]], new_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []
    for item in existing:
        key = str(item.get("sourceItemId") or item.get("sourceLegacyItemId") or item.get("slug"))
        if key not in by_id:
            order.append(key)
        by_id[key] = item
    for item in new_items:
        key = str(item.get("sourceItemId") or item.get("sourceLegacyItemId") or item.get("slug"))
        if key not in by_id:
            order.append(key)
        by_id[key] = item
    return [by_id[k] for k in order]


def save_and_rebuild(products: List[Dict[str, Any]]):
    write_json(SOURCE_FILE, products)
    # Rebuild normalized catalog.
    code = os.system(f'"{sys.executable}" "{BUILD_SCRIPT}"')
    if code != 0:
        raise RuntimeError("build_products_json.py failed")


def incremental_import(category: str, total: int, per_request: int, detail_mode: bool = True) -> Dict[str, Any]:
    presets = read_json(PRESET_FILE, {})
    brands = (presets.get("brands") or {}).get(category) or []
    if not brands:
        raise RuntimeError(f"No brand preset found for category '{category}'")
    query = (presets.get("queries") or {}).get(category) or category
    category_name = (presets.get("category_names") or {}).get(category) or category.title()
    exclude_terms = presets.get("exclude_terms") or []

    token = get_access_token()
    existing = load_catalog()
    existing_ids = {str(x.get("sourceItemId") or x.get("sourceLegacyItemId")) for x in existing if x.get("sourceItemId") or x.get("sourceLegacyItemId")}
    existing_slugs = {str(x.get("slug")) for x in existing if x.get("slug")}
    state = read_json(STATE_FILE, {"categories": {}})
    cat_state = state.setdefault("categories", {}).setdefault(category, {"brands": {}})
    for brand in brands:
        cat_state.setdefault("brands", {}).setdefault(brand, {"offset": 0, "runs": 0, "added": 0, "emptyPages": 0})

    quota_per_brand = math.ceil(total / len(brands))
    added: List[Dict[str, Any]] = []
    stats = {brand: 0 for brand in brands}

    for brand in brands:
        if len(added) >= total:
            break
        state_row = cat_state["brands"][brand]
        needed = min(quota_per_brand, total - len(added))
        tries = 0
        while stats[brand] < needed and tries < 20:
            tries += 1
            offset = int(state_row.get("offset") or 0)
            payload = discover_items(token, brand=brand, category=category, query=query, offset=offset, limit=per_request)
            items = payload.get("itemSummaries") or []
            state_row["offset"] = offset + per_request
            state_row["runs"] = int(state_row.get("runs") or 0) + 1
            if not items:
                state_row["emptyPages"] = int(state_row.get("emptyPages") or 0) + 1
                break
            page_added = 0
            for summary in items:
                summary["_campmate_category"] = category
                item_id = str(summary.get("itemId") or summary.get("legacyItemId") or "")
                if not item_id or item_id in existing_ids:
                    continue
                if should_skip(summary, brand, category, exclude_terms):
                    continue
                item = summary
                if detail_mode:
                    try:
                        detailed = get_item_details(token, item_id)
                        detailed["_campmate_category"] = category
                        # Carry forward useful fallback fields.
                        for field in ("price", "marketingPrice", "image", "itemAffiliateWebUrl", "itemWebUrl", "legacyItemId", "listingMarketplaceId", "title", "subtitle", "shortDescription"):
                            if field not in detailed and field in summary:
                                detailed[field] = summary[field]
                        item = detailed
                    except Exception:
                        item = summary
                product = import_one(item, category=category, category_name=category_name, fallback_brand=brand, existing_slugs=existing_slugs)
                if str(product.get("sourceItemId")) in existing_ids:
                    continue
                existing_ids.add(str(product.get("sourceItemId")))
                added.append(product)
                stats[brand] += 1
                page_added += 1
                if stats[brand] >= needed or len(added) >= total:
                    break
            if page_added == 0:
                # Move on so the next run progresses instead of looping same page forever.
                continue
            time.sleep(0.25)
        state_row["added"] = int(state_row.get("added") or 0) + stats[brand]

    merged = merge_products(existing, added)
    save_and_rebuild(merged)
    write_json(STATE_FILE, state)
    return {
        "category": category,
        "requested": total,
        "added": len(added),
        "brands": stats,
        "sourceCount": len(merged),
        "stateFile": str(STATE_FILE),
    }


def main():
    load_env()
    parser = argparse.ArgumentParser(description="Incrementally import eBay AU camping products into CampMate")
    parser.add_argument("--category", required=True, choices=["tents", "chairs", "coolers", "stoves", "lanterns", "sleep-systems"])
    parser.add_argument("--total", type=int, default=60, help="Total new products to try adding this run")
    parser.add_argument("--per-request", type=int, default=100, help="eBay search page size (max 200)")
    parser.add_argument("--no-detail", action="store_true", help="Skip getItem enrichment for speed")
    args = parser.parse_args()

    if args.per_request < 1 or args.per_request > 200:
        raise SystemExit("--per-request must be between 1 and 200")

    result = incremental_import(args.category, args.total, args.per_request, detail_mode=not args.no_detail)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
