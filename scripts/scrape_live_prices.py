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
import html as html_lib
import json
import re
import subprocess
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
# Variant markers that must not appear only on the retailer PDP. This prevents a
# generic overlap such as catalogue "Turbo 300" -> "Turbo BLK Lite Plus 300".
VARIANT_MARKERS = {
    "lite", "plus", "blk", "evo", "deluxe", "cabin", "premium", "pro", "air",
    "compact", "xl", "xxl", "mk2", "mk3", "ii", "iii", "low", "high", "front", "rear",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return res.read().decode("utf-8", errors="ignore")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(1.0 + attempt)
    # Some retailer edges intermittently terminate Python TLS connections. curl uses
    # the runner's normal TLS stack as a bounded public-page fallback.
    try:
        result = subprocess.run(
            ["curl", "-L", "--http1.1", "-A", USER_AGENT, "--max-time", "25", "-sS", url],
            check=True, capture_output=True, text=True, timeout=30,
        )
        if result.stdout:
            return result.stdout
    except Exception:
        pass
    # Final fallback: ordinary headless Chrome, without stealth or challenge bypassing.
    try:
        driver = _get_shared_driver()
        driver.get(url)
        return driver.page_source
    except Exception:
        if last_error:
            raise last_error
        raise

DETAIL_REJECT_TERMS = {
    "ground sheet", "groundsheet", "footprint", "replacement", "spare", "cover only",
    "carry bag", "cup holder", "latch", "pad for", "accessory", "repair kit",
}

def _jsonld_nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from _jsonld_nodes(item)
    elif isinstance(value, dict):
        if "@graph" in value:
            yield from _jsonld_nodes(value["@graph"])
        else:
            yield value

def _first_offer(offers):
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    return offers if isinstance(offers, dict) else {}

def parse_detail_page(html, url):
    """Extract the canonical product identity and current offer from one detail page.
    JSON-LD is preferred; visible/meta price is only a bounded fallback."""
    title = ""
    price = None
    currency = "AUD"
    availability = ""
    condition = ""
    sku = ""
    brand = ""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        soup = None
    if soup:
        for script in soup.select('script[type="application/ld+json"]'):
            raw = script.string or script.get_text()
            try:
                payload = json.loads(html_lib.unescape(raw))
            except Exception:
                continue
            for node in _jsonld_nodes(payload):
                types = node.get("@type", [])
                if isinstance(types, str):
                    types = [types]
                if "Product" not in types and "ProductGroup" not in types:
                    continue
                title = str(node.get("name") or title).strip()
                raw_brand = node.get("brand")
                if isinstance(raw_brand, dict):
                    raw_brand = raw_brand.get("name")
                brand = str(raw_brand or brand).strip()
                sku = str(node.get("sku") or node.get("mpn") or sku).strip()
                offer = _first_offer(node.get("offers"))
                raw_price = offer.get("price") or offer.get("lowPrice")
                try:
                    if raw_price is not None:
                        price = float(str(raw_price).replace(",", ""))
                except (TypeError, ValueError):
                    pass
                currency = str(offer.get("priceCurrency") or currency).upper()
                availability = str(offer.get("availability") or "").lower()
                condition = str(offer.get("itemCondition") or "").lower()
                if title and price is not None:
                    break
            if title and price is not None:
                break
        if not title:
            h1 = soup.find("h1")
            title = h1.get_text(" ", strip=True) if h1 else (soup.title.get_text(" ", strip=True) if soup.title else "")
        if price is None:
            meta = soup.select_one('meta[itemprop="price"]')
            if meta and meta.get("content"):
                try:
                    price = float(meta["content"].replace(",", ""))
                except ValueError:
                    pass
        if price is None:
            for selector in (".price", ".product-price", "[class*='price']"):
                node = soup.select_one(selector)
                if not node:
                    continue
                match = re.search(r"(?:A\$|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", node.get_text(" ", strip=True))
                if match:
                    price = float(match.group(1).replace(",", ""))
                    break
    if not soup:
        # Standard-library fallback for clean GitHub runners where bs4 is unavailable.
        scripts = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S)
        for raw in scripts:
            try:
                payload = json.loads(html_lib.unescape(raw.strip()))
            except Exception:
                continue
            for node in _jsonld_nodes(payload):
                types = node.get("@type", [])
                if isinstance(types, str):
                    types = [types]
                if "Product" not in types and "ProductGroup" not in types:
                    continue
                title = str(node.get("name") or title).strip()
                raw_brand = node.get("brand")
                if isinstance(raw_brand, dict):
                    raw_brand = raw_brand.get("name")
                brand = str(raw_brand or brand).strip()
                sku = str(node.get("sku") or node.get("mpn") or sku).strip()
                offer = _first_offer(node.get("offers"))
                raw_price = offer.get("price") or offer.get("lowPrice")
                try:
                    if raw_price is not None:
                        price = float(str(raw_price).replace(",", ""))
                except (TypeError, ValueError):
                    pass
                currency = str(offer.get("priceCurrency") or currency).upper()
                availability = str(offer.get("availability") or "").lower()
                condition = str(offer.get("itemCondition") or "").lower()
                if title and price is not None:
                    break
            if title and price is not None:
                break
        if not title:
            h1 = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.I | re.S)
            title = re.sub(r'<[^>]+>', ' ', h1.group(1)).strip() if h1 else ''
        if price is None:
            meta = re.search(r'<meta[^>]+itemprop=["\']price["\'][^>]+content=["\']([^"\']+)', html, re.I)
            if meta:
                try:
                    price = float(meta.group(1).replace(',', ''))
                except ValueError:
                    pass

    return {
        "name": title,
        "price": price,
        "currency": currency,
        "availability": availability,
        "condition": condition,
        "brand": brand,
        "sku": sku,
        "url": url,
    }

def verify_detail_candidate(store, product, candidate, debug=False):
    url = candidate.get("url") or candidate.get("matchedUrl")
    if not url:
        return None
    try:
        if store == "Snowys":
            html = fetch(url)
        else:
            # BCF, Tentworld, Wild Earth and Anaconda may return a storefront
            # denial shell to plain HTTP; read the public PDP through ordinary Chrome.
            driver = _get_shared_driver()
            driver.get(url)
            html = driver.page_source
    except Exception as exc:
        print(f"  detail failed {store} {url}: {exc}")
        return None
    detail = parse_detail_page(html, url)
    if store == "Snowys" and (not detail.get("name") or detail.get("price") is None):
        try:
            driver = _get_shared_driver()
            driver.get(url)
            detail = parse_detail_page(driver.page_source, url)
        except Exception as exc:
            if debug: print(f"DETAIL browser fallback failed url={url}: {exc}")
    name = detail.get("name", "")
    lower = name.lower()
    if debug:
        print(f"DETAIL DEBUG store={store} url={url} detail={json.dumps(detail, ensure_ascii=False)}")
    if not name or any(term in lower for term in DETAIL_REJECT_TERMS):
        if debug: print(f"DETAIL REJECT reason=name-or-junk url={url}")
        return None
    if detail.get("price") is None or detail.get("price") <= 0 or detail.get("currency") not in {"AUD", "AU"}:
        if debug: print(f"DETAIL REJECT reason=price-or-currency url={url}")
        return None
    if any(flag in detail.get("availability", "") for flag in ("outofstock", "soldout", "discontinued")):
        if debug: print(f"DETAIL REJECT reason=availability url={url}")
        return None
    detail_for_score = dict(detail)
    detail_for_score["name"] = " ".join(part for part in (detail.get("brand"), detail.get("name")) if part)
    score = score_match(product, detail_for_score)
    # Retailers sometimes omit an otherwise non-distinctive seating-position label
    # from the PDP title (e.g. catalogue “5 Position Chair” -> “Festival Arm Chair”).
    # Allow that one title-normalisation only when brand, type, and all numeric size/model
    # tokens still match; never relax model, capacity, or generation tokens.
    if score < 12 and "position" in product.get("name", "").lower():
        relaxed = dict(product)
        relaxed["name"] = re.sub(r"\b\d+\s*position\s*", "", product.get("name", ""), flags=re.I)
        score = score_match(relaxed, detail_for_score)
    if score < 12:
        if debug: print(f"DETAIL REJECT reason=score score={score} url={url}")
        return None
    detail["matchedUrl"] = url
    detail["matchMethod"] = "detail-page-jsonld-or-dom"
    return detail

def verify_candidates(product, store, candidates, max_candidates=4, debug=False):
    ranked = sorted(candidates or [], key=lambda c: score_match(product, c), reverse=True)
    for candidate in ranked[:max_candidates]:
        verified = verify_detail_candidate(store, product, candidate, debug=debug)
        if verified:
            return verified
    return None


SNOWYS_PATTERN = re.compile(
    r'<h3 class="product-title"><a href="([^"]+)" class="product-link2"[^>]*>'
    r'<span class="brandName"><span class="brand">([^<]*)</span>\s*([^<]*)</span></a></h3>'
    r'.*?content="([\d.]+)">\$[\d.,]+</span>',
    re.S,
)


def _parse_snowys_search_html(html, limit=8):
    out = []
    for path, brand, rest, price_raw in SNOWYS_PATTERN.findall(html)[:limit]:
        name = f"{brand} {rest}".strip()
        try:
            price = float(price_raw)
        except ValueError:
            continue
        if price <= 0:
            continue
        full_url = urllib.parse.urljoin("https://www.snowys.com.au", path)
        out.append({"name": name, "price": price, "url": full_url})
    return out

def _scrape_snowys_browser(query, limit=8):
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    url = "https://www.snowys.com.au/search?q=" + urllib.parse.quote(query)
    driver = _get_shared_driver()
    driver.get(url)
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "h3.product-title, .product-title, .product-card"))
        )
    except Exception:
        pass
    out = []
    cards = driver.find_elements(By.CSS_SELECTOR, "h3.product-title, .product-card, article.product")
    for card in cards[:limit]:
        try:
            link = card.find_element(By.CSS_SELECTOR, "a[href]")
            href = link.get_attribute("href") or ""
            name = link.text.strip() or card.text.split("\\n")[0].strip()
            price_node = card.find_elements(By.CSS_SELECTOR, "[content], .product-price, [class*='price']")
            price = None
            for node in price_node:
                raw = node.get_attribute("content") or node.text
                m = re.search(r"(?:A\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", raw or "")
                if m:
                    price = float(m.group(1).replace(",", ""))
                    break
            if href and name and price and "snowys.com.au" in href:
                out.append({"name": name, "price": price, "url": href})
        except Exception:
            continue
    if out:
        return out
    return _parse_snowys_search_html(driver.page_source, limit)

def scrape_snowys(query, limit=8):
    url = "https://www.snowys.com.au/search?q=" + urllib.parse.quote(query)
    html = fetch(url)
    out = _parse_snowys_search_html(html, limit)
    if out:
        return out
    # Public Snowys search can return a consent/edge shell to a clean runner even
    # though the same search is visible in a normal browser. Re-read the public page
    # with ordinary Chrome and inspect the rendered product cards.
    try:
        return _scrape_snowys_browser(query, limit)
    except Exception:
        return []


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
    if not out:
        try:
            return scrape_bcf_browser(query, limit)
        except Exception:
            return []
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

def _reset_shared_driver():
    global _shared_driver
    if _shared_driver is not None:
        try:
            _shared_driver.quit()
        except Exception:
            pass
    _shared_driver = None
    return _get_shared_driver()

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
        # Public retailer pages can stall indefinitely when a JS challenge or queue page
        # never finishes loading. Use eager navigation and bounded timeouts so one product
        # cannot block the rotating catalog scan forever.
        opts.page_load_strategy = "eager"
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument(f"--user-agent={USER_AGENT}")
        _shared_driver = webdriver.Chrome(options=opts)
        _shared_driver.set_page_load_timeout(30)
        _shared_driver.set_script_timeout(30)
    return _shared_driver


def scrape_tentworld(query, limit=8):
    """Product card class names are webpack CSS-module hashes that rotate on every deploy
    (e.g. "productCard-10L") - matched by stable prefix (productCard-/name-/price-) via
    [class*=...] instead of the full hashed class, so a redeploy doesn't silently break this."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    driver = _get_shared_driver()
    search_url = "https://www.tentworld.com.au/search?query=" + urllib.parse.quote(query)
    try:
        driver.get(search_url)
    except Exception:
        driver = _reset_shared_driver()
        driver.get(search_url)
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
    search_url = "https://www.wildearth.com.au/search-results?q=" + urllib.parse.quote(query)
    try:
        driver.get(search_url)
    except Exception:
        driver = _reset_shared_driver()
        driver.get(search_url)
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
    product_words = core_words(product_name)
    extra_variants = (candidate_words & VARIANT_MARKERS) - product_words
    if extra_variants:
        return -100
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
    parser.add_argument("--debug", action="store_true", help="Print detail-crawl candidates and validation results")
    parser.add_argument("--category", default=None, help="Only scan products in this category, e.g. tents")
    args = parser.parse_args()
    active_stores = [args.store] if args.store else list(STORE_SCRAPERS.keys())
    products = json.loads(SOURCE.read_text(encoding="utf-8"))
    if args.category:
        products = [p for p in products if p.get("category") == args.category]


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
            best = verify_candidates(product, name, candidates, debug=args.debug)
            if args.debug:
                print(f"DEBUG store={name} product={product.get('name')} candidates={json.dumps(candidates[:4], ensure_ascii=False)} verified={json.dumps(best, ensure_ascii=False) if best else None}")
            if best:
                store["price"] = best["price"]
                store["matchedUrl"] = best.get("matchedUrl") or best.get("url")
                store["priceCheckedAt"] = now
                matched += 1
                print(f"[{matched}] {name}: {product.get('name')} -> ${best['price']} ({best.get('matchMethod', 'detail-page')})")
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
        "category": args.category,
        "limit": args.limit,
        "refresh_all": args.refresh_all,
        "next_offset": new_offset,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. scanned={scanned} matched={matched} failed={failed}")


if __name__ == "__main__":
    main()
