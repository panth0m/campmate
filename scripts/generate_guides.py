#!/usr/bin/env python3
"""
CampMate — 자동 가이드 생성기
실행: python scripts/generate_guides.py
매일 GitHub Actions가 자동 실행
"""

import json
import os
import random
import re
import sys
from datetime import date
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
GUIDES_DIR = ROOT / "guides"
SITEMAP_FILE = ROOT / "sitemap.xml"
BASE_URL = "https://campmate.kangseyoung7.workers.dev"
TODAY = date.today().isoformat()

GTAG = """<!-- Google tag (gtag.js) --><script async src="https://www.googletagmanager.com/gtag/js?id=G-RRL35ZW8MO"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-RRL35ZW8MO');</script>"""

CATEGORY_LABELS = {
    "tents": "Camping Tents",
    "chairs": "Camping Chairs",
    "coolers": "Coolers & Ice Boxes",
    "stoves": "Camping Stoves",
    "lanterns": "Camping Lanterns",
    "sleep-systems": "Sleeping Bags & Mats",
}

CATEGORY_PAGES = {
    "tents": "tents",
    "chairs": "chairs",
    "coolers": "coolers",
    "stoves": "stoves",
    "lanterns": "lanterns",
    "sleep-systems": "sleeping-bags",
}

SEASON_TIPS = {
    "tents": "Australian summers can be intense — look for tents with strong ventilation and UV-rated fabrics. In cooler months, a tent with a good hydrostatic head rating (2000mm+) will handle rain comfortably.",
    "chairs": "For beach camping, look for chairs with wider feet that won't sink into sand. For bush camping, a compact folding chair that packs small is ideal for the car boot.",
    "coolers": "In Australian summer heat, a quality cooler with 3–5 days of ice retention makes a real difference. For shorter trips, a basic 25–30L icebox is often enough.",
    "stoves": "Wind is the biggest challenge for camp cooking in Australia. A stove with a built-in windshield or a side-burner design handles coastal and outback conditions much better.",
    "lanterns": "Rechargeable LED lanterns have improved dramatically — many now last 40–60 hours on a single charge. Solar-charging models are great for longer trips.",
    "sleep-systems": "Australian nights can surprise you — even in summer, alpine and southern regions drop well below 10°C. Always check a sleeping bag's comfort rating, not just its lower limit.",
}


def load_products():
    path = DATA_DIR / "products.json"
    if not path.exists():
        path = DATA_DIR / "products_source.json"
    with open(path) as f:
        return json.load(f)


def slugify(text):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def currency(val):
    try:
        return f"${int(float(val)):,}"
    except Exception:
        return str(val)


def nav_html(active="guides"):
    return f"""<header class="topbar"><div class="container nav">
<a class="logo" href="/"><span class="logo-badge">⛺</span><span>CampMate Australia</span></a>
<nav class="nav-links">
  <a href="/">Home</a>
  <a href="/categories">Categories</a>
  <a href="/popular">Popular</a>
  <a href="/guides" class="active">Guides</a>
</nav>
<form class="nav-search" data-search-form>
  <input class="input" name="q" placeholder="Search tents, coolers, chairs...">
  <button class="btn" type="submit">Search</button>
</form>
</div></header>"""


def footer_html():
    return """<footer class="footer"><div class="container footer-grid">
<div><div class="logo" style="margin-bottom:12px"><span class="logo-badge">⛺</span><span>CampMate Australia</span></div>
<p>CampMate helps Australian campers compare useful camping gear, read buyer-first guides and click through to store searches with clear disclosure.</p>
<p class="muted" style="margin-top:12px">Disclosure: CampMate may earn commissions from affiliate links at no additional cost to you.</p></div>
<div><strong>Browse</strong><div class="list" style="margin-top:12px">
<a href="/categories">All categories</a>
<a href="/popular">Popular products</a>
<a href="/guides">Guides</a>
</div></div>
<div><strong>Trust &amp; contact</strong><div class="list" style="margin-top:12px">
<a href="/about">About CampMate</a>
<a href="/contact">Contact</a>
<a href="/disclosure">Affiliate disclosure</a>
<a href="/privacy">Privacy</a>
</div></div>
</div></footer>
<script src="../assets/data.js"></script>
<script src="../assets/common.js"></script>
<script>setupSearchForm();enhanceImages();</script>"""


def wrap_page(title, desc, canonical, body, schema=None):
    schema_tag = f'<script type="application/ld+json">{json.dumps(schema)}</script>' if schema else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="google-site-verification" content="FYOS27d6BEVJvMcO6uM-zBCBEWVeriEPClO6j2-X6uY">
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="#061325">
<link rel="apple-touch-icon" href="../assets/icons/apple-touch-icon.png">
<link rel="stylesheet" href="../assets/style.css">
{GTAG}
{schema_tag}
</head>
<body>
{nav_html()}
{body}
{footer_html()}
</body>
</html>"""


# ─── 글 유형 1: 브랜드 vs 브랜드 비교 ───────────────────────

def generate_comparison(product_a, product_b):
    """두 상품 비교 글 생성"""
    brand_a = product_a["brand"]
    brand_b = product_b["brand"]
    cat = product_a["category"]
    cat_label = CATEGORY_LABELS.get(cat, cat.title())
    cat_page = CATEGORY_PAGES.get(cat, "categories")

    slug_a = product_a.get("slug", slugify(product_a["name"]))
    slug_b = product_b.get("slug", slugify(product_b["name"]))
    name_a = f"{brand_a} {product_a['name']}"
    name_b = f"{brand_b} {product_b['name']}"

    price_a = product_a.get("salePrice") or product_a.get("price", 0)
    price_b = product_b.get("salePrice") or product_b.get("price", 0)
    rating_a = float(product_a.get("rating") or 0)
    rating_b = float(product_b.get("rating") or 0)
    reviews_a = int(product_a.get("reviews") or 0)
    reviews_b = int(product_b.get("reviews") or 0)

    # 승자 결정
    score_a = (rating_a * 0.5) + (reviews_a / 100 * 0.3) + (1 / (price_a + 1) * 1000 * 0.2)
    score_b = (rating_b * 0.5) + (reviews_b / 100 * 0.3) + (1 / (price_b + 1) * 1000 * 0.2)
    winner = name_a if score_a >= score_b else name_b
    winner_slug = slug_a if score_a >= score_b else slug_b

    guide_slug = f"{slugify(brand_a)}-vs-{slugify(brand_b)}-{slugify(cat)}"
    filename = f"{guide_slug}.html"
    canonical = f"{BASE_URL}/guides/{guide_slug}"

    title = f"{brand_a} vs {brand_b} {cat_label} — Which Should You Buy? | CampMate Australia"
    desc = f"Compare {name_a} and {name_b}. Prices, ratings, specs and store links for Australian campers."

    season_tip = SEASON_TIPS.get(cat, "")

    # 하이라이트 태그
    def highlights(p):
        hl = p.get("highlights", [])
        if not hl:
            return ""
        return " ".join(f'<span class="tag-chip">{h}</span>' for h in hl[:4])

    body = f"""<main class="page-hero"><div class="container">
<div class="breadcrumb"><a href="/">Home</a> · <a href="/guides">Guides</a> · <span>{brand_a} vs {brand_b}</span></div>
<article class="card guide-article">
  <div class="badge">Comparison guide · {TODAY}</div>
  <h1>{brand_a} vs {brand_b} {cat_label}: Which Is Better for Australian Campers?</h1>
  <p class="muted">{desc}</p>

  <h2>Quick verdict</h2>
  <p>Both {brand_a} and {brand_b} make strong {cat_label.lower()} for Australian conditions.
  After comparing price, rating and real-world reviews, <strong>{winner}</strong> edges ahead for most buyers —
  but the right choice depends on your budget and trip style. Read on for the full breakdown.</p>

  <h2>Side-by-side comparison</h2>
  <div class="grid-2" style="gap:16px;margin:20px 0">

    <div class="card" style="padding:20px">
      <div class="badge">{brand_a}</div>
      <h3 style="margin:10px 0 6px">{name_a}</h3>
      <p class="muted" style="font-size:.85rem">{product_a.get('summary','')}</p>
      <div style="margin:12px 0">{highlights(product_a)}</div>
      <div class="metric-row" style="margin:12px 0">
        <span class="metric-chip good">{currency(price_a)}</span>
        <span class="metric-chip">⭐ {rating_a}</span>
        <span class="metric-chip">{reviews_a} reviews</span>
      </div>
      <a class="btn small" href="../products/{slug_a}">Compare stores →</a>
    </div>

    <div class="card" style="padding:20px">
      <div class="badge">{brand_b}</div>
      <h3 style="margin:10px 0 6px">{name_b}</h3>
      <p class="muted" style="font-size:.85rem">{product_b.get('summary','')}</p>
      <div style="margin:12px 0">{highlights(product_b)}</div>
      <div class="metric-row" style="margin:12px 0">
        <span class="metric-chip good">{currency(price_b)}</span>
        <span class="metric-chip">⭐ {rating_b}</span>
        <span class="metric-chip">{reviews_b} reviews</span>
      </div>
      <a class="btn small" href="../products/{slug_b}">Compare stores →</a>
    </div>

  </div>

  <h2>Price comparison</h2>
  <p>{name_a} is currently listed at <strong>{currency(price_a)}</strong> across Australian retailers,
  while {name_b} comes in at <strong>{currency(price_b)}</strong>.
  {"That's a difference of " + currency(abs(price_a - price_b)) + " — worth considering if you're on a tight budget." if abs(price_a - price_b) > 20 else "The prices are closely matched, so focus on features rather than cost."}</p>

  <h2>Ratings and reviews</h2>
  <p>{name_a} holds a <strong>{rating_a} star</strong> rating from {reviews_a} reviews,
  {"which is impressive for a product at this price point." if rating_a >= 4.5 else "which is solid for everyday camping use."}
  {name_b} scores <strong>{rating_b} stars</strong> from {reviews_b} reviews —
  {"a strong result that reflects consistent buyer satisfaction." if rating_b >= 4.5 else "suggesting it performs reliably for the intended use."}</p>

  <h2>Australian conditions tip</h2>
  <p>{season_tip}</p>

  <h2>Our recommendation</h2>
  <p>For most Australian campers, <strong><a href="../products/{winner_slug}">{winner}</a></strong> is the stronger all-round choice.
  That said, both products are worth comparing live store prices before you buy — deals change regularly.</p>

  <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0">
    <a class="btn" href="../products/{slug_a}">See {brand_a} prices</a>
    <a class="btn secondary" href="../products/{slug_b}">See {brand_b} prices</a>
    <a class="btn secondary" href="/{cat_page}">Browse all {cat_label}</a>
  </div>

  <p class="muted" style="font-size:.8rem;margin-top:16px">
    Disclosure: CampMate may earn a commission if you click through and make a purchase. 
    Reference prices are updated regularly but may differ from current retailer pricing.
  </p>
</article>
</div></main>"""

    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": desc,
        "datePublished": TODAY,
        "dateModified": TODAY,
        "author": {"@type": "Organization", "name": "CampMate Australia"},
        "publisher": {"@type": "Organization", "name": "CampMate Australia"},
    }

    return filename, wrap_page(title, desc, canonical, body, schema)


# ─── 글 유형 2: TOP 10 추천 글 ───────────────────────────────

def generate_top10(category, products):
    """카테고리별 TOP 10 추천 글 생성"""
    cat_label = CATEGORY_LABELS.get(category, category.title())
    cat_page = CATEGORY_PAGES.get(category, "categories")
    season_tip = SEASON_TIPS.get(category, "")

    # 평점 + 리뷰수 기준 정렬 → 상위 10개
    sorted_prods = sorted(
        products,
        key=lambda p: (float(p.get("rating") or 0) * 0.6 + min(int(p.get("reviews") or 0), 500) / 500 * 0.4),
        reverse=True,
    )[:10]

    year = date.today().year
    guide_slug = f"top-10-{slugify(cat_label)}-australia-{year}"
    filename = f"{guide_slug}.html"
    canonical = f"{BASE_URL}/guides/{guide_slug}"

    title = f"Top 10 {cat_label} in Australia ({year}) | CampMate"
    desc = f"The best {cat_label.lower()} for Australian campers in {year}. Compare prices, ratings and store links before you buy."

    items_html = ""
    for i, p in enumerate(sorted_prods, 1):
        slug = p.get("slug", slugify(p["name"]))
        name = f"{p['brand']} {p['name']}"
        price = p.get("salePrice") or p.get("price", 0)
        rating = float(p.get("rating") or 0)
        reviews = int(p.get("reviews") or 0)
        summary = p.get("summary", "")
        hl = p.get("highlights", [])
        tags = " ".join(f'<span class="tag-chip">{h}</span>' for h in hl[:3])

        medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(i, f"#{i}")

        items_html += f"""
  <div class="card" style="padding:20px;margin-bottom:16px">
    <div style="display:flex;align-items:flex-start;gap:14px">
      <span style="font-size:1.8rem;flex-shrink:0">{medal}</span>
      <div style="flex:1;min-width:0">
        <div class="badge">{p['brand']}</div>
        <h3 style="margin:6px 0"><a href="../products/{slug}">{name}</a></h3>
        <p class="muted" style="font-size:.85rem;margin:4px 0">{summary}</p>
        <div style="margin:8px 0">{tags}</div>
        <div class="metric-row">
          <span class="metric-chip good">{currency(price)}</span>
          <span class="metric-chip">⭐ {rating}</span>
          <span class="metric-chip">{reviews} reviews</span>
        </div>
        <a class="btn small" style="margin-top:10px" href="../products/{slug}">Compare store prices →</a>
      </div>
    </div>
  </div>"""

    top1 = sorted_prods[0] if sorted_prods else None
    top1_name = f"{top1['brand']} {top1['name']}" if top1 else ""
    top1_slug = top1.get("slug", "") if top1 else ""

    body = f"""<main class="page-hero"><div class="container">
<div class="breadcrumb"><a href="/">Home</a> · <a href="/guides">Guides</a> · <span>Top 10 {cat_label} {year}</span></div>
<article class="card guide-article">
  <div class="badge">Buying guide · Updated {TODAY}</div>
  <h1>Top 10 Best {cat_label} in Australia ({year})</h1>
  <p class="muted">{desc}</p>

  <h2>How we ranked these</h2>
  <p>CampMate ranks {cat_label.lower()} based on buyer ratings, review volume and value for money across Australian retailers. 
  We look for products that consistently perform well for Australian conditions — not just specs on paper.</p>

  <h2>Australian buying tip</h2>
  <p>{season_tip}</p>

  <h2>The top 10 list</h2>
  {items_html}

  <h2>Where to buy</h2>
  <p>All products above link through to live store searches at BCF, Anaconda, Amazon AU, eBay AU and more.
  Prices change regularly — always check current pricing before you buy.</p>
  {"<p>Our top pick for most buyers is <strong><a href='../products/" + top1_slug + "'>" + top1_name + "</a></strong> — it consistently scores well across price, rating and real-world reviews.</p>" if top1 else ""}

  <a class="btn" href="/{cat_page}">Browse all {cat_label} →</a>

  <p class="muted" style="font-size:.8rem;margin-top:20px">
    Disclosure: CampMate may earn a commission if you click through and make a purchase. 
    Rankings are based on aggregated data and are updated regularly.
  </p>
</article>
</div></main>"""

    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": desc,
        "datePublished": TODAY,
        "dateModified": TODAY,
        "author": {"@type": "Organization", "name": "CampMate Australia"},
        "publisher": {"@type": "Organization", "name": "CampMate Australia"},
    }

    return filename, wrap_page(title, desc, canonical, body, schema)


# ─── 사이트맵 업데이트 ────────────────────────────────────────


def update_guides_index():
    """guides/index.json 갱신 — guides.html이 이걸 읽어서 동적으로 목록 표시"""
    import re as _re
    guides = []
    for path in sorted(GUIDES_DIR.glob("*.html")):
        with open(path) as f:
            c = f.read()
        h1 = _re.search(r'<h1[^>]*>([^<]+)</h1>', c)
        desc = _re.search(r'<meta name="description" content="([^"]+)"', c)
        badge = _re.search(r'class="badge">([^<]+)</div>', c)
        fname = path.name
        # 글 유형 판별
        if 'vs' in fname:
            gtype = 'comparison'
        elif 'top-10' in fname or 'top-5' in fname or h1 and h1.group(1).lower().startswith('best '):
            gtype = 'best-list'
        elif h1 and h1.group(1).lower().startswith('how to '):
            gtype = 'how-to'
        else:
            gtype = 'guide'

        guides.append({
            'slug': Path(fname).stem,
            'file': fname,
            'title': h1.group(1) if h1 else fname.replace('-', ' ').replace('.html', '').title(),
            'desc': desc.group(1) if desc else '',
            'type': gtype,
            'date': TODAY,
        })

    index_path = DATA_DIR / "guides_index.json"
    with open(index_path, 'w') as f:
        json.dump(guides, f, indent=2, ensure_ascii=False)
    print(f"  guides_index.json: {len(guides)}개 가이드 등록")

def update_sitemap(new_slugs):
    if not SITEMAP_FILE.exists():
        print("sitemap.xml not found, skipping update")
        return

    with open(SITEMAP_FILE) as f:
        content = f.read()

    added = 0
    for slug in new_slugs:
        url = f"{BASE_URL}/guides/{Path(slug).stem}"
        if url in content:
            continue
        entry = f'  <url><loc>{url}</loc><lastmod>{TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>'
        content = content.replace("</urlset>", entry + "\n</urlset>")
        added += 1

    with open(SITEMAP_FILE, "w") as f:
        f.write(content)

    print(f"  sitemap.xml: {added}개 URL 추가")


# ─── 메인 ─────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("CampMate 가이드 자동 생성기")
    print(f"날짜: {TODAY}")
    print("=" * 50)

    products = load_products()
    print(f"상품 로드: {len(products)}개\n")

    GUIDES_DIR.mkdir(exist_ok=True)
    generated = []

    # 이미 생성된 파일 목록
    existing = {f.name for f in GUIDES_DIR.glob("*.html")}

    # ── 1. TOP 10 글 (카테고리별) ──────────────────────────────
    print("▶ TOP 10 가이드 생성 중...")
    for cat in CATEGORY_LABELS:
        cat_products = [p for p in products if p.get("category") == cat]
        if len(cat_products) < 3:
            continue

        filename, html = generate_top10(cat, cat_products)
        path = GUIDES_DIR / filename

        if filename in existing:
            print(f"  스킵 (이미 존재): {filename}")
            continue

        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        generated.append(filename)
        print(f"  ✅ {filename}")

    # ── 2. 브랜드 vs 브랜드 비교 글 ────────────────────────────
    print("\n▶ 브랜드 비교 가이드 생성 중...")

    # 카테고리별로 브랜드 쌍 생성 (각 카테고리 최대 3쌍)
    MAX_COMPARISONS_PER_CAT = 3
    year = date.today().year

    for cat in CATEGORY_LABELS:
        cat_products = [p for p in products if p.get("category") == cat]
        if len(cat_products) < 2:
            continue

        # 평점 높은 상품들로 쌍 구성
        top_products = sorted(cat_products, key=lambda p: float(p.get("rating") or 0), reverse=True)[:6]
        pairs = list(combinations(top_products, 2))
        random.shuffle(pairs)

        count = 0
        for pa, pb in pairs:
            if pa["brand"] == pb["brand"]:
                continue

            brand_a = slugify(pa["brand"])
            brand_b = slugify(pb["brand"])
            cat_slug = slugify(cat)
            filename = f"{brand_a}-vs-{brand_b}-{cat_slug}.html"

            if filename in existing:
                print(f"  스킵 (이미 존재): {filename}")
                continue

            _, html = generate_comparison(pa, pb)
            path = GUIDES_DIR / filename
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            generated.append(filename)
            print(f"  ✅ {filename}")
            count += 1
            if count >= MAX_COMPARISONS_PER_CAT:
                break

    # ── 사이트맵 업데이트 ──────────────────────────────────────
    if generated:
        print(f"\n▶ 사이트맵 업데이트...")
        update_sitemap(generated)

    print(f"\n▶ 가이드 인덱스 업데이트...")
    update_guides_index()

    print(f"\n{'=' * 50}")
    print(f"완료! 새 가이드 {len(generated)}개 생성")
    for f in generated:
        print(f"  → guides/{f}")

    if not generated:
        print("  (모든 가이드가 이미 존재합니다)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
