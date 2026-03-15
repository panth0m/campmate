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


def score_item(product: dict, item: dict):
    title = str(item.get("title") or "")
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
    if item.get("image", {}).get("imageUrl"):
        score += 4
    if item.get("price", {}).get("value"):
        score += 1
    return score


def should_refresh(product: dict, refresh_all: bool):
    if refresh_all:
        return True
    image = str(product.get("ebayImage") or "")
    if image.startswith("http://") or image.startswith("https://"):
        return False
    image2 = str(product.get("image") or "")
    return image2.endswith(".svg") or not image2


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=40)
    parser.add_argument("--refresh-all", action="store_true")
    parser.add_argument("--delay", type=float, default=0.2)
    args = parser.parse_args()

    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    token = get_token()
    touched = 0
    scanned = 0
    changed = 0

    for product in products:
        if scanned >= args.limit:
            break
        if not should_refresh(product, args.refresh_all):
            continue
        scanned += 1
        query = f'{product.get("brand", "")} {product.get("name", "")}'.strip()
        if not query:
            continue
        try:
            items = browse_search(token, query, limit=6)
        except Exception as e:
            print(f"Skip {product.get('name')}: {e}")
            time.sleep(args.delay)
            continue
        if not items:
            time.sleep(args.delay)
            continue
        ranked = sorted(items, key=lambda item: score_item(product, item), reverse=True)
        best = ranked[0]
        best_score = score_item(product, best)
        if best_score < 6:
            time.sleep(args.delay)
            continue
        image = best.get("image", {}).get("imageUrl")
        if not image:
            time.sleep(args.delay)
            continue
        old = product.get("ebayImage") or product.get("image") or ""
        product["ebayImage"] = image
        touched += 1
        if old != image:
            changed += 1
            print(f"[{changed}] {product.get('name')} -> image synced")
        time.sleep(args.delay)

    SOURCE.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    rebuild_products()
    report = {
        "scanned": scanned,
        "touched": touched,
        "changed": changed,
        "limit": args.limit,
        "refresh_all": args.refresh_all,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. scanned={scanned} touched={touched} changed={changed}")
    print(f"Saved report to {REPORT}")


if __name__ == "__main__":
    main()
