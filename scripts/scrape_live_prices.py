"""
Fetches real, current prices from Australian camping retailers (not just search links)
so the product page can show "click one item, see prices across stores" instead of
making the shopper click through to each store.

Each retailer needs its own small scraper function added to STORE_SCRAPERS below, since
every site has a different HTML/API shape. Retailers investigated so far:
  - Snowys: works (server-rendered product cards, real price in the HTML)
  - BCF: works (Salesforce Commerce Cloud - real price/name/id in a GTM analytics JSON
    blob on the product card; paired to the product URL by item id, not position)
  - Wild Earth: blocks plain HTTP requests (403) - would need a real browser
    (Selenium/Playwright) to even attempt, not implemented
  - Anaconda: redirect loop on this URL pattern - needs further investigation
  - Amazon AU, Tentworld: not investigated yet

Usage:
  python scrape_live_prices.py --limit 40                 # scan next 40 unpriced products
  python scrape_live_prices.py --limit 20 --store Snowys   # only this store
  python scrape_live_prices.py --refresh-all --limit 40    # re-check even already-priced ones
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "products_source.json"
REPORT = ROOT / "data" / "live_price_last_run.json"

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
from build_products_json import main as rebuild_products  # noqa: E402

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

JUNK_MATCH_TERMS = {
    "sticker", "decal", "spare", "replacement", "part", "repair kit", "cover only",
    "bag only", "footprint", "groundsheet", "pole", "peg", "guy rope",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode("utf-8", errors="ignore")


SNOWYS_PATTERN = re.compile(
    r'<h3 class="product-title"><a href="([^"]+)" class="product-link2"[^>]*>'
    r'<span class="brandName"><span class="brand">([^<]*)</span>\s*([^<]*)</span></a></h3>'
    r'.*?content="([\d.]+)">\$[\d.,]+</span>',
    re.S,
)


def scrape_snowys(query, limit=8):
    url = "https://www.snowys.com.au/search?q=" + urllib.parse.quote(query)
    html = fetch(url)
    out = []
    for path, brand, rest, price_raw in SNOWYS_PATTERN.findall(html)[:limit]:
        name = f"{brand} {rest}".strip()
        try:
            price = float(price_raw)
        except ValueError:
            continue
        if price <= 0:
            continue
        out.append({"name": name, "price": price, "url": "https://www.snowys.com.au" + path})
    return out


BCF_GTM_PATTERN = re.compile(r'data-gtm="([^"]*add_to_cart[^"]*)"')
BCF_HREF_PATTERN = re.compile(r'class="name-link" href="([^"]+)"')


def scrape_bcf(query, limit=8):
    """BCF (Salesforce Commerce Cloud) server-renders a GTM analytics JSON payload per
    product card (name/brand/price/id) inside the Add-to-Cart button's data-gtm attribute.
    Pair it to the product's real URL by item id (not position - the two lists can be
    different lengths when some cards lack an add-to-cart button, e.g. out of stock)."""
    url = "https://www.bcf.com.au/search?q=" + urllib.parse.quote(query)
    html = fetch(url)
    hrefs = BCF_HREF_PATTERN.findall(html)
    href_by_id = {}
    for href in hrefs:
        m = re.search(r"/(\d+)\.html", href)
        if m:
            href_by_id[m.group(1)] = href
    out = []
    for blob in BCF_GTM_PATTERN.findall(html)[:limit * 2]:
        try:
            data = json.loads(urllib.parse.unquote(blob))
            item = data["ecommerce"]["items"][0]
            item_id = str(item.get("item_id"))
            price = float(item.get("price"))
        except Exception:
            continue
        href = href_by_id.get(item_id)
        if not href or price <= 0:
            continue
        out.append({"name": str(item.get("item_name") or ""), "price": price, "url": "https://www.bcf.com.au" + href})
        if len(out) >= limit:
            break
    return out


STORE_SCRAPERS = {
    "Snowys": scrape_snowys,
    "BCF": scrape_bcf,
}


STOPWORDS = {"the", "and", "with", "for", "of", "in", "to", "a", "an"}


def norm_words(text):
    return set(w for w in re.findall(r"[a-z0-9]+", str(text).lower()) if len(w) > 1)


def core_words(text):
    """norm_words minus filler words - these are the tokens that actually distinguish one
    product from another (model names like 'MiniMo' vs 'Stash', not 'the'/'with')."""
    return norm_words(text) - STOPWORDS


def size_tokens(text):
    """Capacity/size markers like '8P', '300', '45L' - these distinguish otherwise-identical
    product names (e.g. 'Instant Up 6P' vs 'Instant Up 8P') and word-overlap scoring alone
    does not weight them enough to avoid cross-matching different sizes of the same range."""
    return set(re.findall(r"\b\d{1,4}\s?(?:p|l|qt|person)?\b", str(text).lower()))


def product_type_word(name):
    """Product names in this catalogue reliably end with the type noun ('...Tent',
    '...Chair', '...Cooler'). That last word is a strong same-product-vs-accessory signal
    that plain word-overlap scoring misses (an awning/footprint/spare-part listing for the
    same product line shares most other words with the tent itself)."""
    words = re.findall(r"[a-zA-Z]+", str(name or ""))
    return words[-1].lower() if words else ""


def score_match(product, candidate):
    text = str(candidate.get("name") or "").lower()
    if any(term in text for term in JUNK_MATCH_TERMS):
        return -100
    product_name = product.get("name", "")
    candidate_words = norm_words(candidate.get("name", ""))
    # Hard gate: every distinctive word in OUR product name must appear in the candidate,
    # not just "most of them". Model names (Jetboil "MiniMo" vs "The Stash") are exactly the
    # kind of single differentiating word that a fuzzy overlap score lets slip through even
    # when brand + category words all line up - so require full containment, not a ratio.
    missing = core_words(product_name) - candidate_words
    if missing:
        return -100
    score = len(norm_words(product_name) & candidate_words) * 5
    brand = str(product.get("brand") or "").lower()
    if brand and brand in text:
        score += 10
    # Size/capacity mismatch is a hard signal, not a soft one: if the product name has a
    # size marker (e.g. "8P") and the candidate has size markers but none match, this is
    # almost certainly the wrong variant even if every other word lines up.
    product_sizes = size_tokens(product_name)
    candidate_sizes = size_tokens(candidate.get("name", ""))
    if product_sizes and candidate_sizes and not (product_sizes & candidate_sizes):
        score -= 50
    # Same guard for product type: "Tent" matching only an "Awning"/"Shade"/"Footprint"
    # listing for the same product line is a different physical item, not a size variant.
    type_word = product_type_word(product_name)
    if type_word and type_word not in candidate_words:
        score -= 50
    return score


def find_best_match(product, candidates):
    if not candidates:
        return None
    ranked = sorted(candidates, key=lambda c: score_match(product, c), reverse=True)
    best = ranked[0]
    if score_match(product, best) < 12:
        return None
    # Reject if a close second candidate has a different price - means the match is
    # ambiguous between two real products rather than clearly pointing at one.
    if len(ranked) > 1:
        second = ranked[1]
        if score_match(product, second) >= score_match(product, best) - 2 and second.get("price") != best.get("price"):
            return None
    return best


def needs_price(store, refresh_all):
    return refresh_all or not store.get("price")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=40, help="Max products to scan this run")
    parser.add_argument("--store", default=None, help="Only scrape this one store (default: all implemented)")
    parser.add_argument("--delay", type=float, default=1.5, help="Seconds between requests (politeness)")
    parser.add_argument("--refresh-all", action="store_true")
    args = parser.parse_args()

    active_stores = [args.store] if args.store else list(STORE_SCRAPERS.keys())
    products = json.loads(SOURCE.read_text(encoding="utf-8"))

    scanned = 0
    matched = 0
    failed = 0
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    for product in products:
        if scanned >= args.limit:
            break
        stores = product.get("stores") or []
        touched = False
        for store in stores:
            name = store.get("name")
            if name not in active_stores or name not in STORE_SCRAPERS:
                continue
            if not needs_price(store, args.refresh_all):
                continue
            touched = True
            query = f'{product.get("brand", "")} {product.get("name", "")}'.strip()
            try:
                candidates = STORE_SCRAPERS[name](query)
            except urllib.error.HTTPError as e:
                print(f"  {name} blocked/error for {product.get('name')}: HTTP {e.code}")
                failed += 1
                candidates = []
            except Exception as e:
                print(f"  {name} search failed for {product.get('name')}: {e}")
                failed += 1
                candidates = []
            # `url` is left untouched - it's always the safe generic search link. A confident
            # match adds `price`/`matchedUrl` on top; the frontend shows those when present
            # and falls back to the plain "Open search" link otherwise. This way a bad/no
            # match can never leave a stale wrong product link sitting on the safe field.
            best = find_best_match(product, candidates)
            if best:
                store["price"] = best["price"]
                store["matchedUrl"] = best["url"]
                store["priceCheckedAt"] = now
                matched += 1
                print(f"[{matched}] {name}: {product.get('name')} -> ${best['price']}")
            else:
                store.pop("price", None)
                store.pop("matchedUrl", None)
                store["priceCheckedAt"] = now  # avoid re-hammering a no-match every run
            time.sleep(args.delay)
        if touched:
            scanned += 1

    SOURCE.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    rebuild_products()
    report = {
        "scanned": scanned,
        "matched": matched,
        "failed": failed,
        "stores": active_stores,
        "limit": args.limit,
        "refresh_all": args.refresh_all,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. scanned={scanned} matched={matched} failed={failed}")


if __name__ == "__main__":
    main()
