#!/usr/bin/env python3
import json, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
VER = '20260316'

CATEGORY_FILES = {
    'tents': 'tents.html',
    'chairs': 'chairs.html',
    'coolers': 'coolers.html',
    'stoves': 'stoves.html',
    'lanterns': 'lanterns.html',
    'sleep-systems': 'sleeping-bags.html',
}


def esc(s):
    return html.escape(str(s or ''), quote=True)


def currency(n):
    try:
        return f"A${int(round(float(n or 0))):,}"
    except Exception:
        return 'A$0'


def store_price(store):
    try:
        value = float(store.get('price') or 0)
        return value if value > 0 else 0
    except Exception:
        return 0


def live_price(product):
    prices = [store_price(store) for store in product.get('stores') or []]
    prices = [price for price in prices if price > 0]
    return min(prices) if prices else 0


def lowest_store(product):
    verified = [store for store in product.get('stores') or [] if store_price(store) > 0]
    return min(verified, key=store_price) if verified else None


def store_price_label(store):
    price = store_price(store)
    return currency(price) if price else 'Price not verified'


def review_score(p):
    try:
        rating = float(p.get('rating') or 0)
        reviews = int(p.get('reviews') or 0)
        stores = len(p.get('stores') or [])
        return rating * 100 + min(reviews, 500) * 0.2 + stores * 2
    except Exception:
        return 0


def sort_products(items, key='recommended'):
    items = list(items)
    if key == 'price-asc':
        return sorted(items, key=lambda p: float(p.get('salePrice') or p.get('price') or 0))
    if key == 'price-desc':
        return sorted(items, key=lambda p: float(p.get('salePrice') or p.get('price') or 0), reverse=True)
    if key == 'rating':
        return sorted(items, key=lambda p: (float(p.get('rating') or 0), int(p.get('reviews') or 0)), reverse=True)
    return sorted(items, key=review_score, reverse=True)


def normalize_image(product):
    return product.get('ebayImage') or product.get('image') or f"assets/images/categories/{product.get('category','generic')}.svg"


def extract_capacity(text):
    if not text:
        return None
    value = str(text)
    for pat in [r'(\d{1,2})\s*[- ]?person', r'(\d{1,2})\s*[pP]\b', r'for\s*(\d{1,2})\b']:
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


def infer_specs(product):
    vals = []
    for item in (product.get('highlights') or [])[:2]:
        if item:
            item_text = str(item).strip()
            if not re.search(r'(?i)capacity:\s*00\s*person|\b00[- ]?person\b|\b0[- ]?person\b', item_text):
                vals.append(item_text)
    if vals:
        return vals[:2]
    specs = product.get('specs') or {}
    cap = str(specs.get('Capacity') or '').strip()
    if cap and not (cap.lower() in {'00 person', '0 person', '00-person', '0-person', '0p', '00p'} or re.search(r'(?i)^capacity:\s*00\s*person$', cap)):
        cap_num = extract_capacity(cap)
        vals.append(f"{cap_num}-person capacity" if cap_num else f"Capacity: {cap}")
    for key in ('Weight', 'Pack weight'):
        spec_val = str(specs.get(key) or '').strip()
        if not spec_val:
            continue
        vals.append(f"{key}: {spec_val}")
    if not vals:
        text = ' '.join(str(product.get(k) or '') for k in ('name', 'summary', 'description'))
        cap_num = extract_capacity(text)
        if cap_num:
            vals.append(f"{cap_num}-person capacity")
    return vals[:2]


def build_affiliate_url(store_name, url):
    url = str(url or '#')
    if 'amazon.com.au' in url and 'tag=' not in url:
        join = '&' if '?' in url else '?'
        return f"{url}{join}tag=campmateau20-22"
    return url


def product_link(product):
    return f"/products/{product['slug']}"


def category_link(cat):
    return cat.get('page') or '/' + cat['slug']


def stars_html(rating):
    try:
        rounded = round(float(rating or 0))
    except Exception:
        rounded = 0
    rounded = max(0, min(5, rounded))
    return '★' * rounded + '☆' * (5 - rounded)


def category_product_row(product):
    stores = []
    best = lowest_store(product)
    best_name = str(best.get('name') or '') if best else ''
    for store in (product.get('stores') or [])[:3]:
        name = str(store.get('name') or '')
        price = store_price(store)
        url = build_affiliate_url(name, store.get('matchedUrl') or store.get('url'))
        is_best = price > 0 and best and abs(price - store_price(best)) < 0.005
        price_markup = (
            f'<a class="store-price-link" data-store="{esc(name)}" data-price="{price:.2f}" target="_blank" rel="noopener sponsored" href="{esc(url)}">{store_price_label(store)} ↗</a>'
            if price > 0 and url != '#'
            else f'<span class="store-price-unverified" data-store="{esc(name)}">{store_price_label(store)}</span>'
        )
        stores.append(
            f'<div class="dw-row-store{" is-lowest" if is_best else ""}"><span>{esc(name)}</span>{price_markup}</div>'
        )
    highlights = ''.join(f'<span class="dw-row-hl">{esc(h)}</span>' for h in infer_specs(product))
    meta = []
    if product.get('rating'):
        meta.append(f'<span class="stars">{stars_html(product.get("rating"))}</span> {float(product.get("rating") or 0):.1f}')
    if product.get('reviews'):
        meta.append(f'<span>{int(product.get("reviews") or 0)} reviews</span>')
    return f'''<article class="dw-row-item" data-product-query="{esc(product.get('name'))}">
    <a class="dw-row-img" href="{product_link(product)}">
      <img src="{esc(normalize_image(product))}?v={VER}" alt="{esc(product.get('name'))}" loading="lazy" data-category="{esc(product.get('category'))}">
    </a>
    <div class="dw-row-info">
      <div class="dw-row-brand">
        <strong>{esc(product.get('brand'))}</strong>
        <span class="soft-badge">{esc(product.get('categoryName') or product.get('category','').replace('-', ' ').title())}</span>
      </div>
      <a class="dw-row-title" href="{product_link(product)}">{esc(product.get('name'))}</a>
      <p class="dw-row-summary">{esc((product.get('summary') or '')[:160])}</p>
      {f'<div class="dw-row-highlights">{highlights}</div>' if highlights else ''}
      <div class="dw-row-meta">{' '.join(meta)}</div>
    </div>
    <div class="dw-row-price">
      {f'<a class="sale-price lowest-price-link" target="_blank" rel="noopener sponsored" href="{esc(build_affiliate_url(best_name, best.get("matchedUrl") or best.get("url")))}">{currency(store_price(best))} ↗</a>' if best and (best.get("matchedUrl") or best.get("url")) else f'<div class="sale-price">{currency(live_price(product) or product.get("salePrice") or product.get("price"))}</div>'}
      <div class="price-source">{(f'Lowest verified price · {esc(best_name)}' if best else 'Reference price')}</div>
      {f'<div class="orig-price">{currency(product.get("salePrice") or product.get("price"))}</div>' if live_price(product) and product.get('salePrice') and live_price(product) != product.get('salePrice') else ''}
      <div class="dw-row-stores">{''.join(stores)}</div>
      <a class="dw-row-compare-btn" href="{product_link(product)}">Compare →</a>
    </div>
  </article>'''


def category_card(cat, count, products):
    subset = [p for p in products if p.get('category') == cat['slug']]
    top_brands = []
    for brand in [p.get('brand') for p in subset[:50] if p.get('brand')]:
        if brand not in top_brands:
            top_brands.append(brand)
    top_brands = top_brands[:4]
    prices = [live_price(p) or float(p.get('salePrice') or p.get('price') or 0) for p in subset if live_price(p) or float(p.get('salePrice') or p.get('price') or 0) > 0]
    start_price = min(prices) if prices else 0
    badges = ''.join(f'<span class="soft-badge">{esc(brand)}</span>' for brand in top_brands)
    return f'''
  <article class="hub-card">
    <a href="{category_link(cat)}"><img src="assets/images/categories/{cat['slug']}.svg" alt="{esc(cat['name'])}" data-category="{esc(cat['slug'])}"></a>
    <div>
      <div class="metric-row"><span class="badge">{count} compare pages</span>{f'<span class="soft-badge">From {currency(start_price)}</span>' if start_price else ''}</div>
      <a class="title" style="font-size:1.25rem;margin-top:10px" href="{category_link(cat)}">{esc(cat['name'])}</a>
      <p class="muted">{esc(cat.get('description') or '')}</p>
      <div class="hub-stats">{badges}</div>
    </div>
    <div><a class="btn small" href="{category_link(cat)}">Open</a></div>
  </article>'''


def popular_row(product, index):
    soft = product.get('categoryName') or product.get('category','').replace('-', ' ').title()
    ptype = (product.get('highlights') or [None])[0] or soft
    return f'''
    <article class="rank-row">
      <div class="rank-num">{index + 1}</div>
      <a href="{product_link(product)}"><img src="{esc(normalize_image(product))}" alt="{esc(product.get('name'))}" data-category="{esc(product.get('category'))}"></a>
      <div>
        <div class="metric-row"><span class="soft-badge">{esc(product.get('brand'))}</span><span class="soft-badge">{esc(ptype)}</span></div>
        <a class="title" style="margin:8px 0 6px" href="{product_link(product)}">{esc(product.get('name'))}</a>
        <div class="tiny">{esc(soft)}</div>
      </div>
      <div class="price-stack"><strong>{currency(live_price(product) or product.get('salePrice') or product.get('price'))}</strong><span class="tiny">{('Lowest verified store price' if live_price(product) else 'Reference')}</span></div>
      <div class="tiny">{stars_html(product.get('rating'))}<br>{int(product.get('reviews') or 0)} reviews</div>
      <div><a class="btn small" href="{product_link(product)}">Compare</a></div>
    </article>'''


def replace_section(file_path, start_pattern, replacement):
    text = file_path.read_text(encoding='utf-8')
    text = re.sub(start_pattern, replacement, text, count=1, flags=re.S)
    file_path.write_text(text, encoding='utf-8')


def replace_category_page(file_path, products):
    text = file_path.read_text(encoding='utf-8')
    html_rows = ''.join(category_product_row(p) for p in sort_products(products, 'recommended'))
    text = re.sub(r'(<strong id="result-count">)(\d+)(</strong>)', rf'\g<1>{len(products)}\3', text, count=1)
    text = re.sub(r'(<div id="category-results" class="dw-product-list">).*?(</div>\s*</div>\s*</main>)', rf'\1{html_rows}\2', text, count=1, flags=re.S)
    file_path.write_text(text, encoding='utf-8')


def replace_categories_hub(file_path, categories, products):
    counts = {}
    for p in products:
        counts[p.get('category')] = counts.get(p.get('category'), 0) + 1
    cards = ''.join(category_card(cat, counts.get(cat['slug'], 0), products) for cat in categories)
    replace_section(file_path, r'(<div class="grid-2" id="category-hub-grid">).*?(</div>\s*</div>\s*</main>)', rf'\1{cards}\2')


def replace_popular(file_path, products):
    rows = ''.join(popular_row(p, i) for i, p in enumerate(sort_products(products, 'recommended')[:30]))
    replace_section(file_path, r'(<div id="popular-ranking" class="ranking-list">).*?(</div>\s*</div>\s*</main>)', rf'\1{rows}\2')


def main():
    categories = json.load(open(DATA / 'categories.json', 'r', encoding='utf-8'))
    products = json.load(open(DATA / 'products.json', 'r', encoding='utf-8'))
    for slug, filename in CATEGORY_FILES.items():
        subset = [p for p in products if p.get('category') == slug]
        replace_category_page(ROOT / filename, subset)
    replace_categories_hub(ROOT / 'categories.html', categories, products)
    replace_popular(ROOT / 'popular.html', products)
    print('Rebuilt static category, categories, and popular pages')


if __name__ == '__main__':
    main()
