import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "products_source.json"
REPORT = ROOT / "data" / "image_sync_last_run.json"

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
from build_products_json import main as rebuild_products  # noqa: E402

BANNED = {
    "sticker", "decal", "logo", "patch", "spare", "replacement", "parts", "part", "peg",
    "pole", "strap", "zipper", "repair", "cap", "lid", "cup", "pot", "cover", "bag",
    "case", "adapter", "hose", "burner only", "valve", "sleeve", "lanyard", "badge",
    # damaged/non-working listings shouldn't become the "hero" product photo either
    "faulty", "not working", "broken", "damaged", "no power",
    "as is", "as-is", "untested", "for parts",
}
CATEGORY_HINTS = {
    "tents": ["tent", "swag", "shelter", "gazebo"],
    "chairs": ["chair", "seat", "stool", "recliner", "loveseat"],
    "coolers": ["cooler", "ice box", "icebox", "fridge", "esky"],
    "stoves": ["stove", "burner", "grill", "cooker", "jetboil"],
    "lanterns": ["lantern", "light", "headlamp", "lamp"],
    "sleep-systems": ["sleeping", "bag", "mat", "pad", "cot", "quilt"],
}


def load_env(path: Path):
    values = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")


def norm_words(text: str):
    return [w for w in re.findall(r"[a-z0-9]+", str(text).lower()) if len(w) > 1]


def get_token():
    env = {**load_env(ROOT / ".env"), **os.environ}
    client_id = env.get("EBAY_CLIENT_ID")
    client_secret = env.get("EBAY_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in .env / environment")
    creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}).encode()
    req = urllib.request.Request(
        "https://api.ebay.com/identity/v1/oauth2/token",
        data=data,
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        payload = json.load(res)
    return payload["access_token"]


def get_google_credentials():
    env = {**load_env(ROOT / ".env"), **os.environ}
    api_key = env.get("GOOGLE_API_KEY")
    cse_id = env.get("GOOGLE_CSE_ID")
    if not api_key or not cse_id:
        return None
    return api_key, cse_id


def browse_search(token: str, query: str, limit: int = 6):
    url = (
        "https://api.ebay.com/buy/browse/v1/item_summary/search?"
        + urllib.parse.urlencode({"q": query, "limit": limit, "filter": "buyingOptions:{FIXED_PRICE}"})
    )
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res).get("itemSummaries", [])


def google_image_search(api_key: str, cse_id: str, query: str, limit: int = 6):
    """Web-wide product photo search (not limited to eBay listings), via Google Custom
    Search JSON API in image mode. Requires a Custom Search Engine configured for image
    search (see README_이미지검색설정.md near the caller)."""
    url = "https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode({
        "key": api_key,
        "cx": cse_id,
        "q": query,
        "searchType": "image",
        "num": min(max(limit, 1), 10),
        "safe": "active",
    })
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res).get("items", [])


def score_item(product: dict, title: str, has_image: bool, has_price: bool):
    title_words = set(norm_words(title))
    product_words = set(norm_words(product.get("name") or ""))
    brand = str(product.get("brand") or "").lower()
    category = str(product.get("category") or "")

    score = 0
    score += len(product_words & title_words) * 5
    if brand and brand in title.lower():
        score += 10
    for hint in CATEGORY_HINTS.get(category, []):
        if hint in title.lower():
            score += 3
    lower = title.lower()
    if any(bad in lower for bad in BANNED):
        score -= 40
    if has_image:
        score += 4
    if has_price:
        score += 1
    return score


def score_ebay_item(product: dict, item: dict):
    title = str(item.get("title") or "")
    has_image = bool(item.get("image", {}).get("imageUrl"))
    has_price = bool(item.get("price", {}).get("value"))
    return score_item(product, title, has_image, has_price)


def score_google_item(product: dict, item: dict):
    title = str(item.get("title") or "")
    # Google image results are already "has an image" by definition; no price signal.
    return score_item(product, title, has_image=True, has_price=False)


def should_refresh(product: dict, refresh_all: bool):
    if refresh_all:
        return True
    image = str(product.get("ebayImage") or "")
    if image.startswith("http://") or image.startswith("https://"):
        return False
    image2 = str(product.get("image") or "")
    return image2.endswith(".svg") or not image2


def find_best_image(product: dict, token: str, google_creds):
    """Try eBay listing photos first (specific to the exact product, usually most accurate
    for exact models); fall back to a general web image search when eBay has no good match
    (useful for brand-new/rare products or ones with only stock-photo-free listings)."""
    query = f'{product.get("brand", "")} {product.get("name", "")}'.strip()
    if not query:
        return None, None

    try:
        items = browse_search(token, query, limit=6)
    except Exception as e:
        print(f"  eBay search failed for {product.get('name')}: {e}")
        items = []
    if items:
        ranked = sorted(items, key=lambda item: score_ebay_item(product, item), reverse=True)
        best = ranked[0]
        if score_ebay_item(product, best) >= 6:
            image = best.get("image", {}).get("imageUrl")
            if image:
                return image, "ebay"

    if google_creds:
        api_key, cse_id = google_creds
        try:
            items = google_image_search(api_key, cse_id, query, limit=6)
        except Exception as e:
            print(f"  Google image search failed for {product.get('name')}: {e}")
            items = []
        if items:
            ranked = sorted(items, key=lambda item: score_google_item(product, item), reverse=True)
            best = ranked[0]
            if score_google_item(product, best) >= 6:
                image = best.get("link")
                if image:
                    return image, "google"

    return None, None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=40)
    parser.add_argument("--refresh-all", action="store_true")
    parser.add_argument("--delay", type=float, default=0.2)
    args = parser.parse_args()

    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    token = get_token()
    google_creds = get_google_credentials()
    if not google_creds:
        print("Note: GOOGLE_API_KEY/GOOGLE_CSE_ID not set - only searching eBay listing photos. "
              "See README_이미지검색설정.md to enable web-wide image search.")
    touched = 0
    scanned = 0
    changed = 0
    source_counts = {"ebay": 0, "google": 0}

    for product in products:
        if scanned >= args.limit:
            break
        if not should_refresh(product, args.refresh_all):
            continue
        scanned += 1

        image, source = find_best_image(product, token, google_creds)
        if not image:
            time.sleep(args.delay)
            continue

        old = product.get("ebayImage") or product.get("image") or ""
        product["ebayImage"] = image
        product["imageSource"] = source
        touched += 1
        source_counts[source] = source_counts.get(source, 0) + 1
        if old != image:
            changed += 1
            print(f"[{changed}] {product.get('name')} -> image synced ({source})")
        time.sleep(args.delay)

    SOURCE.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    rebuild_products()
    report = {
        "scanned": scanned,
        "touched": touched,
        "changed": changed,
        "sources": source_counts,
        "limit": args.limit,
        "refresh_all": args.refresh_all,
        "google_enabled": bool(google_creds),
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. scanned={scanned} touched={touched} changed={changed} sources={source_counts}")
    print(f"Saved report to {REPORT}")


if __name__ == "__main__":
    main()
