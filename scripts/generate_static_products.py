#!/usr/bin/env python3
import json, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_DIR = ROOT / "products"
DATA_FILE = ROOT / "data" / "products.json"
VER = "20260316"
BASE_URL = "https://campmate.kangseyoung7.workers.dev"

CAT_LABELS = {
    "tents": "Camping Tents",
    "chairs": "Camping Chairs",
    "coolers": "Coolers & Ice Boxes",
    "stoves": "Camping Stoves",
    "lanterns": "Camping Lanterns",
    "sleep-systems": "Sleeping Bags & Mats",
}
CAT_PAGES = {
    "tents": "/tents",
    "chairs": "/chairs",
    "coolers": "/coolers",
    "stoves": "/stoves",
    "lanterns": "/lanterns",
    "sleep-systems": "/sleeping-bags",
}


def esc(s):
    return html.escape(str(s or ""), quote=True)


def currency(n):
    try:
        return f"A${int(round(float(n or 0))):,}"
    except Exception:
        return "A$0"


def pct(sale, full):
    try:
        s, f = float(sale or 0), float(full or 0)
        if f > s > 0:
            return int(round((f - s) / f * 100))
    except Exception:
        pass
    return 0


def infer_type(p):
    text = f"{p.get('name','')} {p.get('summary','')} {p.get('description','')}".lower()
    cat = p.get("category", "")
    if cat == "tents":
        if "roof top" in text or "rooftop" in text: return "Roof top tent"
        if "instant" in text or "fast frame" in text: return "Instant tent"
        if "air" in text and "chair" not in text: return "Air tent"
        if "swag" in text: return "Swag"
        if "backpack" in text or "hiking" in text or "ultralight" in text: return "Backpacking tent"
        if "canvas" in text: return "Canvas tent"
        return "Camping tent"
    if cat == "chairs":
        if "recliner" in text: return "Recliner chair"
        if "director" in text: return "Director chair"
        if "moon" in text: return "Moon chair"
        if "compact" in text or "helinox" in text or "packable" in text: return "Compact chair"
        return "Camping chair"
    if cat == "coolers":
        if "fridge" in text or "electric" in text: return "Portable fridge"
        if "soft" in text: return "Soft cooler"
        if "wheel" in text: return "Wheeled cooler"
        return "Hard cooler"
    if cat == "stoves":
        if "jetboil" in text or "backpack" in text: return "Backpacking stove"
        if "2 burner" in text or "2-burner" in text or "dual burner" in text: return "2-burner stove"
        return "Camping stove"
    if cat == "lanterns":
        if "solar" in text: return "Solar lantern"
        if "recharge" in text or "usb" in text: return "Rechargeable lantern"
        return "LED lantern"
    if cat == "sleep-systems":
        if "mat" in text or "pad" in text or "mattress" in text: return "Sleeping mat"
        if "down" in text: return "Down sleeping bag"
        return "Sleeping bag"
    return cat.replace("-", " ").title()


def extract_capacity(text):
    if not text:
        return None
    value = str(text)
    patterns = [
        r'(\d{1,2})\s*[- ]?person',
        r'(\d{1,2})\s*[pP]\b',
        r'for\s*(\d{1,2})\b',
    ]
    for pat in patterns:
        m = re.search(pat, value, re.I)
        if m:
            try:
                n = int(m.group(1))
                if 1 <= n <= 20:
                    return n
            except Exception:
                pass
    word_map = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    }
    for word, num in word_map.items():
        if re.search(rf'\b{word}[ -]person\b', value, re.I):
            return num
    if re.search(r'\bsolo\b|\bsingle\b', value, re.I):
        return 1
    return None


def clean_summary(p):
    raw = (p.get("description") or p.get("summary") or "").strip()
    raw = re.sub(r'\s+', ' ', raw)
    raw = re.sub(r'^Rated\s+\d(?:\.\d)?/5\s+from\s+\d+\s+reviews\.\s*', '', raw, flags=re.I)
    raw = re.sub(r'^The\s+.+?\s+is\s+a\s+[a-z\- ]+?\s+(tent|chair|cooler|stove|lantern|sleep system|sleep systems|mat|bag)s?\s+from\s+[^\.]+\.\s*', '', raw, flags=re.I)
    raw = raw.lstrip(',-:; ')
    summary = raw or str(p.get('summary') or p.get('name') or 'Camping gear').strip()
    summary = summary[:320].rstrip(' .')
    if not summary.endswith('.'):
        summary += '.'
    try:
        rating_val = float(p.get('rating') or 0)
        reviews_val = int(p.get('reviews') or 0)
        if rating_val and reviews_val:
            return f"Rated {rating_val:.1f}/5 from {reviews_val} reviews. {summary}"
    except Exception:
        pass
    return summary


def infer_highlights(p):
    highlights = []
    seen = set()

    def add(val):
        val = str(val or '').strip()
        if not val or val in seen:
            return
        seen.add(val)
        highlights.append(val)

    for item in p.get('highlights') or []:
        item_text = str(item)
        low = item_text.lower()
        if '00-person' in low or 'capacity: 00 person' in low or re.search(r'(?i)\b00[- ]?person\b|\b0[- ]?person\b', item_text) or low.strip() in {'00 person', '0 person', '00p', '0p'}:
            continue
        add(item_text)
    text = f"{p.get('name','')} {p.get('summary','')} {p.get('description','')}"
    specs = p.get('specs') or {}
    capacity = extract_capacity(text) or extract_capacity(specs.get('Capacity'))
    if capacity:
        add(f"{capacity}-person capacity")
    hay = text.lower()
    if 'instant' in hay or 'fast frame' in hay:
        add('Fast instant setup')
    if 'air' in hay and p.get('category') == 'tents':
        add('Air beam structure')
    if 'vestibule' in hay:
        add('Gear storage vestibule')
    if 'canvas' in hay:
        add('Canvas construction')
    if 'roof top' in hay or 'rooftop' in hay:
        add('Roof rack camping setup')
    if 'recharge' in hay or 'usb' in hay:
        add('Rechargeable design')
    if 'solar' in hay:
        add('Solar charging support')
    if '2 burner' in hay or '2-burner' in hay or 'dual burner' in hay:
        add('Dual-burner cooking')
    weight = str(specs.get('Weight') or specs.get('Pack weight') or '').strip()
    if weight:
        add(f"Pack weight: {weight}")
    return highlights[:3]


def affiliate_url(store_name, url):
    url = str(url or '#')
    if 'amazon.com.au' in url and 'tag=' not in url:
        join = '&' if '?' in url else '?'
        return f"{url}{join}tag=campmateau20-22"
    if 'ebay.com' in url:
        for ph in ('campid=%253CePN%253E', 'campid=%3CePN%3E', 'campid=<ePN>'):
            url = url.replace(ph, 'campid=5339145146')
        if 'campid=' not in url:
            join = '&' if '?' in url else '?'
            url = f"{url}{join}mkcid=1&mkrid=705-53470-19255-0&siteid=15&campid=5339145146&customid=&toolid=10001&mkevt=1"
        return url
    return url


def image_path(p):
    image = p.get('ebayImage') or p.get('image') or f"assets/images/categories/{p.get('category','generic')}.svg"
    if image.startswith('assets/'):
        return '../' + image
    return image


def build_page(p, all_products):
    slug = p['slug']
    name = p.get('name', 'Product')
    brand = p.get('brand', '')
    cat = p.get('category', '')
    cat_label = CAT_LABELS.get(cat, cat.title())
    cat_page = CAT_PAGES.get(cat, '/categories')
    sale = p.get('salePrice') or p.get('price') or 0
    full = p.get('price') or sale
    rating = float(p.get('rating') or 0)
    reviews = int(p.get('reviews') or 0)
    summary = clean_summary(p)
    image = image_path(p)
    stores = p.get('stores') or []
    highlights = infer_highlights(p)
    specs = p.get('specs') or {}
    saving = pct(sale, full)
    ptype = infer_type(p)
    store_count = len(stores)

    all_specs = {
        'Reference price': currency(sale),
        'Brand': brand,
        'Category': cat_label,
        'Type': ptype,
        'Store options': f'{store_count} stores',
    }
    for key, val in specs.items():
        if key == 'Reference price':
            continue
        spec_val = str(val)
        if spec_val.strip().lower() in {'00 person', '0 person', '00-person', '0-person', '0p', '00p'} or re.search(r'(?i)^capacity:\s*00\s*person$', spec_val):
            continue
        all_specs[str(key)] = spec_val
    if full and full != sale:
        all_specs['Typical full price'] = currency(full)
    if rating:
        all_specs['Rating'] = f'{rating:.1f} / 5'
    if reviews:
        all_specs['Reviews'] = f'{reviews} reviews'
    spec_rows = ''.join(f'<div class="spec-table-row"><strong>{esc(k)}</strong><span>{esc(v)}</span></div>' for k, v in all_specs.items())

    offer_rows = ''
    store_pills = ''
    for s in stores:
        sname = esc(s.get('name', 'Store'))
        surl = esc(affiliate_url(s.get('name', ''), s.get('url', '#')))
        note = 'Marketplace listings' if 'ebay' in sname.lower() else 'Store search'
        offer_rows += f'<div class="offer-row"><div><strong>{sname}</strong></div><div class="muted">{note} for this product</div><div><a class="btn secondary small" target="_blank" rel="noopener sponsored" href="{surl}">Open</a></div></div>'
        store_pills += f'<a class="store-pill small secondary" target="_blank" rel="noopener sponsored" href="{surl}">{sname}</a>'

    hl_chips = ''.join(f'<span class="spec-chip">{esc(h)}</span>' for h in highlights)
    save_html = f'<strong>{saving}%</strong><span class="tiny">Saving vs full price</span>' if saving else '<strong>—</strong><span class="tiny">Saving vs full price</span>'
    score_board = (
        f'<div class="score-box"><strong>{rating:.1f}</strong><span class="tiny">Rating</span></div>'
        f'<div class="score-box"><strong>{reviews}</strong><span class="tiny">Reviews</span></div>'
        f'<div class="score-box"><strong>{store_count}</strong><span class="tiny">Stores</span></div>'
        f'<div class="score-box">{save_html}</div>'
    )

    checklist_items = [f'Key feature: {h}' for h in highlights[:2]] + [
        'Compare the CampMate reference price against current store listings before you buy.',
        'Use live store searches to spot bundles, shipping differences and marketplace alternatives.',
    ]
    checklist = ''.join(f'<div class="rowish"><div>{esc(item)}</div><span class="soft-badge">Compare</span></div>' for item in checklist_items)

    related = [x for x in all_products if x.get('category') == cat and x.get('slug') != slug]
    related.sort(key=lambda x: (x.get('brand') == brand, -(float(x.get('rating') or 0)), -(int(x.get('reviews') or 0)), float(x.get('salePrice') or x.get('price') or 0)))
    related = related[:3]
    related_html = '<div class="dw-product-grid">'
    for r in related:
        r_img = image_path(r)
        r_hl = ''.join(f'<span class="dw-row-hl">{esc(h)}</span>' for h in infer_highlights(r)[:1])
        r_saving = pct(r.get('salePrice'), r.get('price'))
        r_save_html = f'<span class="save-badge" style="margin-left:4px">-{r_saving}%</span>' if r_saving else ''
        r_rating = float(r.get('rating') or 0)
        r_reviews = int(r.get('reviews') or 0)
        related_html += f'''<article class="dw-grid-item">
    <a class="dw-grid-thumb" href="/products/{r['slug']}">
      <img src="{esc(r_img)}?v={VER}" alt="{esc(r.get('name',''))}" loading="lazy" data-category="{esc(cat)}">
    </a>
    <div class="dw-grid-body">
      <div class="dw-row-brand"><strong>{esc(r.get('brand',''))}</strong><span class="soft-badge">{esc(infer_type(r))}</span></div>
      <a href="/products/{r['slug']}" class="dw-grid-title">{esc(r.get('name',''))}</a>
      {f'<div class="dw-row-highlights" style="margin:2px 0">{r_hl}</div>' if r_hl else ''}
      <div class="dw-grid-price">{currency(r.get('salePrice') or r.get('price'))}</div>
      <div class="dw-grid-meta">{'⭐ ' + f'{r_rating:.1f}' if r_rating else ''} {'· ' + str(r_reviews) + ' reviews' if r_reviews else ''} {r_save_html}</div>
      <a class="dw-grid-btn" href="/products/{r['slug']}">Compare →</a>
    </div>
  </article>'''
    related_html += '</div>'

    ld = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': name,
        'description': summary,
        'category': cat_label,
        'brand': {'@type': 'Brand', 'name': brand},
        'offers': {
            '@type': 'Offer',
            'priceCurrency': 'AUD',
            'price': sale,
            'url': f'{BASE_URL}/products/{slug}',
            'availability': 'https://schema.org/InStock',
        },
    }
    if rating and reviews:
        ld['aggregateRating'] = {'@type': 'AggregateRating', 'ratingValue': rating, 'reviewCount': reviews}

    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(name)} | CampMate Australia</title>
<meta name="description" content="{esc(summary[:155])}">
<link rel="canonical" href="{BASE_URL}/products/{slug}">
<meta property="og:title" content="{esc(name)} | CampMate Australia">
<meta property="og:description" content="{esc(summary[:155])}">
<meta property="og:type" content="website">
<meta property="og:url" content="{BASE_URL}/products/{slug}">
<meta property="og:image" content="{image if str(image).startswith('http') else BASE_URL + '/' + esc(image.lstrip('../')) + '?v=' + VER}">
<meta name="twitter:card" content="summary_large_image">
<meta name="google-site-verification" content="FYOS27d6BEVJvMcO6uM-zBCBEWVeriEPClO6j2-X6uY">
<meta name="commission-factory-verification" content="ff3f890461734249a17c395d968021a8">
<link rel="stylesheet" href="../assets/style.css?v={VER}">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RRL35ZW8MO"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-RRL35ZW8MO');</script>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<header class="topbar">
  <div class="container nav">
    <a class="logo" href="/"><span class="logo-badge">⛺</span><span>CampMate Australia</span></a>
    <nav class="nav-links">
      <a href="/">Home</a><a href="/categories">Categories</a>
      <a href="/popular">Popular</a><a href="/guides">Guides</a>
    </nav>
    <form class="nav-search" data-search-form>
      <input class="input" name="q" placeholder="Search tents, coolers, chairs...">
      <button class="btn" type="submit">Search</button>
    </form>
  </div>
</header>
<main class="page-hero">
  <div class="container">
    <div class="breadcrumb"><a href="/">Home</a> · <a href="{cat_page}">{esc(cat_label)}</a> · <span>{esc(name)}</span></div>
    <section class="page-panel">
      <div class="product-hero">
        <div class="product-gallery"><img id="product-image" src="{esc(image)}?v={VER}" alt="{esc(name)}" data-category="{esc(cat)}"></div>
        <div class="product-summary-card">
          <div class="metric-row">
            <span class="badge">{esc(brand)}</span>
            <span class="soft-badge">{esc(cat_label)}</span>
            <span class="soft-badge">{esc(ptype)}</span>
          </div>
          <h1 id="product-title" style="margin:0">{esc(name)}</h1>
          <p id="product-summary" class="muted">{esc(summary)}</p>
          <div class="price-row">
            <span class="sale" id="sale-price">{currency(sale)}</span>
            <span class="old" id="old-price">{currency(full) if full != sale else ''}</span>
          </div>
          <div class="score-board" id="score-board">{score_board}</div>
          <div class="spec-row" id="headline-specs">{hl_chips}</div>
          <div id="quick-store-buttons" class="hero-actions">{store_pills}</div>
        </div>
      </div>
    </section>

    <div class="grid-2" style="margin-top:20px">
      <section class="page-panel">
        <div class="badge">Specs overview</div>
        <h2 style="margin:14px 0 10px">Key details</h2>
        <div id="spec-table" class="spec-table">{spec_rows}</div>
      </section>
      <section class="page-panel">
        <div class="badge gold">Compare merchants</div>
        <h2 style="margin:14px 0 10px">Store paths</h2>
        <div class="offer-head"><div>Store</div><div>How to use it</div><div>Open</div></div>
        <div id="offer-table" class="offer-table">{offer_rows}</div>
      </section>
    </div>

    <div class="grid-2" style="margin-top:20px">
      <section class="page-panel">
        <div class="badge">What to compare</div>
        <div class="list" id="compare-checklist">{checklist}</div>
      </section>
      <section class="page-panel">
        <div class="badge">Similar compare pages</div>
        <h2 style="margin:14px 0 10px">More in {esc(cat_label)}</h2>
        <div id="related-products">{related_html}</div>
      </section>
    </div>
  </div>
</main>
<footer class="footer">
  <div class="container footer-grid">
    <div>
      <div class="logo" style="margin-bottom:12px"><span class="logo-badge">⛺</span><span>CampMate Australia</span></div>
      <p>CampMate is an all-in-one camping gear comparison site for Australia. Browse categories, compare prices, and open live store searches before you buy.</p>
      <p class="muted" style="margin-top:12px">Disclosure: CampMate may earn commissions from affiliate links at no additional cost to you.</p>
    </div>
    <div><strong>Browse</strong><div class="list" style="margin-top:12px"><a href="/categories">All categories</a><a href="/popular">Popular compare pages</a><a href="/guides">Buyer guides</a></div></div>
    <div><strong>Trust &amp; contact</strong><div class="list" style="margin-top:12px"><a href="/about">About</a><a href="/contact">Contact</a><a href="/disclosure">Affiliate disclosure</a><a href="/privacy">Privacy</a></div></div>
  </div>
</footer>
<script src="../assets/i18n.js?v={VER}"></script>
<script src="../assets/common.js?v={VER}"></script>
<script>setupSearchForm();</script>
</body>
</html>'''


def main():
    PRODUCTS_DIR.mkdir(exist_ok=True)
    products = json.load(open(DATA_FILE, 'r', encoding='utf-8'))
    for product in products:
        out = PRODUCTS_DIR / f"{product['slug']}.html"
        out.write_text(build_page(product, products), encoding='utf-8')
    print(f"Generated {len(products)} product pages")


if __name__ == '__main__':
    main()
