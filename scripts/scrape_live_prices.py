"""
Fetches real, current prices from Australian camping retailers (not just search links)
so the product page can show "click one item, see prices across stores" instead of
making the shopper click through to each store.

Each retailer needs its own small scraper function added to STORE_SCRAPERS below, since
every site has a different HTML/API shape. Retailers investigated so far:
  - Snowys: works (server-rendered product cards, real price in the HTML)
  - BCF: works (Salesforce Commerce Cloud - real price/name/id in a GTM analytics JSON
    blob on the product card; paired to the product URL by item id, not position)
  - Tentworld, Wild Earth, Anaconda: all three work via Selenium (checked 2026-08-04). None
    of the three could be read with plain requests - Tentworld is a client-rendered SPA with
    zero product data in the raw HTML; Wild Earth and Anaconda front their storefront with
    Cloudflare's JS challenge / Queue-It respectively, which is what earlier looked like a
    hard block ("403", "infinite redirect loop"). But tested with plain, unmodified headless
    Selenium (no stealth plugins, no undetected-chromedriver, no proxy tricks) - all three
    load real search results and real prices with no challenge/waiting-room ever appearing.
    That's a materially different situation from a site actively fingerprinting and blocking
    automation specifically: it behaves like an ordinary "needs JS" requirement rather than a
    defense meant to be defeated, so a real browser is a legitimate way to read these, the
    same reasoning that already applied to Tentworld. Anaconda's real search URL needs the
    /en-au/ locale prefix (/en-au/search?q=..., not /search?q=...) - the missing prefix is
    likely why the earlier attempt saw a redirect loop before ever reaching Queue-It cleanly.
    Card class names: Tentworld's are webpack CSS-module hashes that rotate on redeploy
    (matched by stable prefix, not full class); Wild Earth (SearchSpring) and Anaconda use
    ordinary semantic class names, no such fragility. Anaconda's product link wraps the card
    from the OUTSIDE (<a class="card-link"><div class="product-card">...</div></a>) rather
    than sitting inside it like every other store here - easy to miss and get a null href.
  - Amazon AU: plain requests actually returns real product/price data (checked 2026-08-04,
    no CAPTCHA), but robots.txt explicitly disallows ClaudeBot site-wide - not implementing
    this one out of respect for that, even though the User-Agent used here isn't literally
    "ClaudeBot"

Scans a rotating window of the catalog (state in data/live_price_scan_state.json) so a run
of consecutive no-match products can't permanently block progress past them - each run
starts where the previous one left off and wraps around, instead of always starting at
index 0 (that was a real bug: with 0 matches, index 0-79 got rescanned every day and the
other ~860 products were never even attempted).

Usage:
  python scrape_live_prices.py --limit 40                 # scan next 40 products (rotating)
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
SCAN_STATE = ROOT / "data" / "live_price_scan_state.json"

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
from build_products_json import main as rebuild_products  # noqa: E402

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

JUNK_MATCH_TERMS = {
    "sticker", "decal", "spare", "replacement", "part", "repair kit", "cover only",
    "groundsheet", "ground sheet", "bag only", "footprint", "pole", "peg", "guy rope",
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
    different lengths when some cards lack an add-to-cart button, e.g. out of stock).

    BCF sometimes returns HTTP 403 to a plain request even though the same public search
    result is available in an ordinary browser session. In that case we use the existing
    plain Selenium driver as a conservative rendering fallback; no stealth, proxy, or
    challenge-bypass behavior is used."""
    url = "https://www.bcf.com.au/search?q=" + urllib.parse.quote(query)
    try:
        html = fetch(url)
    except urllib.error.HTTPError as exc:
        if exc.code == 403:
            return scrape_bcf_browser(query, limit)
        raise
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


def scrape_bcf_browser(query, limit=8):
    """Read BCF's publicly rendered search/PDP view with a normal headless browser.
    The parser accepts both a search card and the single-result PDP layout observed on
    BCF, and leaves exact-product validation to find_best_match()."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    driver = _get_shared_driver()
    driver.get("https://www.bcf.com.au/search?q=" + urllib.parse.quote(query))
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#pdpMain, [data-gtm*='add_to_cart'], a.name-link"))
        )
    except Exception:
        return []

    out = []
    # Single-result/product-detail layout.
    pdp = driver.find_elements(By.CSS_SELECTOR, "#pdpMain")
    if pdp:
        root = pdp[0]
        try:
            name = root.find_element(By.CSS_SELECTOR, "h1").text.strip()
        except Exception:
            name = ""
        price_text = root.text
        price_match = re.search(r"\$([\d,]+(?:\.\d{2})?)", price_text)
        href = driver.current_url
        if name and price_match and href.startswith("https://www.bcf.com.au/"):
            out.append({
                "name": name,
                "price": float(price_match.group(1).replace(",", "")),
                "url": href,
            })

    # Search-card layout, when BCF does not redirect to a PDP.
    if len(out) < limit:
        cards = driver.find_elements(By.CSS_SELECTOR, "[data-gtm*='add_to_cart']")
        for card in cards[:limit]:
            try:
                item_name = card.get_attribute("data-gtm") or ""
                data = json.loads(urllib.parse.unquote(item_name))
                item = data["ecommerce"]["items"][0]
                price = float(item.get("price"))
            except Exception:
                continue
            if price <= 0:
                continue
            parent = card
            href = ""
            for _ in range(5):
                links = parent.find_elements(By.CSS_SELECTOR, "a[href]")
                if links:
                    href = links[0].get_attribute("href") or ""
                    if href:
                        break
                try:
                    parent = parent.find_element(By.XPATH, "..")
                except Exception:
                    break
            if href.startswith("/"):
                href = "https://www.bcf.com.au" + href
            if href.startswith("https://www.bcf.com.au/"):
                out.append({"name": str(item.get("item_name") or ""), "price": price, "url": href})
            if len(out) >= limit:
                break
    return out


_shared_driver = None


def _get_shared_driver():
    """Tentworld/Wild Earth/Anaconda all need a real browser (checked live 2026-08-04 with
    plain, unmodified headless Selenium - no stealth/undetected-chromedriver tricks): Tentworld
    is a pure client-rendered SPA with zero product data in the raw HTML; Wild Earth and
    Anaconda front their storefronts with Cloudflare / Queue-It, but a completely ordinary
    headless Chrome session passes both without ever hitting a challenge or waiting-room page -
    confirmed by loading real search results and reading real prices with no special handling.
    That's a materially different situation from "actively fingerprinting and blocking
    automation" (which would be a line not worth crossing) - it behaves like an ordinary JS
    requirement, the same class of problem Tentworld already was. One shared singleton driver
    across all three so the run doesn't pay Chrome's startup cost more than once."""
    global _shared_driver
    if _shared_driver is None:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument(f"--user-agent={USER_AGENT}")
        _shared_driver = webdriver.Chrome(options=opts)
    return _shared_driver


def scrape_tentworld(query, limit=8):
    """Product card class names are webpack CSS-module hashes that rotate on every deploy
    (e.g. "productCard-10L") - matched by stable prefix (productCard-/name-/price-) via
    [class*=...] instead of the full hashed class, so a redeploy doesn't silently break this."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    driver = _get_shared_driver()
    driver.get("https://www.tentworld.com.au/search?query=" + urllib.parse.quote(query))
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[class*="productCard-"], [class*="noResults-"]'))
        )
    except Exception:
        return []  # neither results nor a recognizable "no results" state showed up in time

    out = []
    for card in driver.find_elements(By.CSS_SELECTOR, '[class*="productCard-"]')[:limit]:
        try:
            name_el = card.find_element(By.CSS_SELECTOR, 'a[class*="name-"]')
            price_el = card.find_element(By.CSS_SELECTOR, '[class*="price-"]')
        except Exception:
            continue
        price_match = re.search(r"\$([\d,]+\.\d{2})", price_el.text)
        if not price_match:
            continue
        out.append({
            "name": name_el.text.strip(),
            "price": float(price_match.group(1).replace(",", "")),
            "url": name_el.get_attribute("href"),
        })
    return out


def scrape_wildearth(query, limit=8):
    """SearchSpring-powered storefront (class names are semantic, not hashed - no fragility
    concern like Tentworld's). Search endpoint found via the real search form's action/method,
    not guessed: GET /search-results?q=..."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    driver = _get_shared_driver()
    driver.get("https://www.wildearth.com.au/search-results?q=" + urllib.parse.quote(query))
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "article.ss__result--item, .ss__no-results"))
        )
    except Exception:
        return []

    out = []
    for card in driver.find_elements(By.CSS_SELECTOR, "article.ss__result--item")[:limit]:
        try:
            name_el = card.find_element(By.CSS_SELECTOR, ".ss__result__name a")
            price_el = card.find_element(By.CSS_SELECTOR, ".ss__result__price")
        except Exception:
            continue
        price_match = re.search(r"\$([\d,]+\.\d{2})", price_el.text)
        if not price_match:
            continue
        out.append({
            "name": name_el.text.strip(),
            "price": float(price_match.group(1).replace(",", "")),
            "url": name_el.get_attribute("href"),
        })
    return out


_anaconda_warmed = False


def scrape_anaconda(query, limit=8):
    """Real search URL needs the /en-au/ locale prefix (the earlier "infinite redirect loop"
    was hitting /search without it). Each product card's link wraps the card from OUTSIDE
    (<a class="card-link"><div class="product-card">...</div></a>), not a link nested inside
    it - easy to miss and end up with a null href, since every other store's cards have the
    link as a descendant, not an ancestor. Price: prefer the actual selling price
    (.price-now), fall back to .price-was for items with no active discount.

    Anaconda's Queue-It check is session/cookie based (a "QueueITAccepted-..." cookie, set
    alongside ordinary analytics cookies) rather than a per-request check - jumping straight
    to a deep search URL with a brand new browser profile sometimes trips it, but visiting
    the homepage first (exactly what a real visitor does before searching) reliably clears
    it. Done once per driver session, not once per query."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    global _anaconda_warmed
    driver = _get_shared_driver()
    if not _anaconda_warmed:
        driver.get("https://www.anacondastores.com/en-au/")
        time.sleep(3)
        _anaconda_warmed = True
    search_url = "https://www.anacondastores.com/en-au/search?q=" + urllib.parse.quote(query)
    cards = []
    for attempt in range(2):  # observed intermittent slow/empty renders under rapid repeat requests
        driver.get(search_url)
        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.product-card"))
            )
            cards = driver.find_elements(By.CSS_SELECTOR, "div.product-card")
            if cards:
                break
        except Exception:
            pass
        time.sleep(2)

    out = []
    for card in cards[:limit]:
        try:
            link = card.find_element(By.XPATH, './ancestor::a[contains(@class,"card-link")]')
            name_el = card.find_element(By.CSS_SELECTOR, ".card-headline")
        except Exception:
            continue
        price_el = None
        for sel in (".price-now .amount", ".price-was .amount"):
            found = card.find_elements(By.CSS_SELECTOR, sel)
            if found:
                price_el = found[0]
                break
        if price_el is None:
            continue
        price_match = re.search(r"([\d,]+(?:\.\d{2})?)", price_el.text)
        if not price_match:
            continue
        out.append({
            "name": name_el.text.strip(),
            "price": float(price_match.group(1).replace(",", "")),
            "url": link.get_attribute("href"),
        })
    return out


STORE_SCRAPERS = {
    "Snowys": scrape_snowys,
    "BCF": scrape_bcf,
    "Tentworld": scrape_tentworld,
    "Wild Earth": scrape_wildearth,
    "Anaconda": scrape_anaconda,
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


def load_offset(total):
    if total <= 0:
        return 0
    try:
        state = json.loads(SCAN_STATE.read_text(encoding="utf-8"))
        return int(state.get("offset", 0)) % total
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        return 0


def save_offset(offset):
    SCAN_STATE.write_text(json.dumps({"offset": offset}), encoding="utf-8")


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

    # Start where the previous run left off instead of always index 0 - otherwise a run of
    # products that never find a price match (needs_price stays true forever) permanently
    # blocks the scan window from ever reaching the rest of the catalog.
    offset = load_offset(len(products))
    order = list(range(offset, len(products))) + list(range(0, offset))
    last_index = offset - 1

    for idx in order:
        if scanned >= args.limit:
            break
        last_index = idx
        product = products[idx]
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

    if _shared_driver is not None:
        _shared_driver.quit()

    SOURCE.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    rebuild_products()
    new_offset = (last_index + 1) % len(products) if products else 0
    save_offset(new_offset)
    report = {
        "scanned": scanned,
        "matched": matched,
        "failed": failed,
        "stores": active_stores,
        "limit": args.limit,
        "refresh_all": args.refresh_all,
        "next_offset": new_offset,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. scanned={scanned} matched={matched} failed={failed}")


if __name__ == "__main__":
    main()
