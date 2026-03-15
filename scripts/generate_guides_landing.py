#!/usr/bin/env python3
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
GUIDES_DIR = ROOT / 'guides'
DATA_DIR = ROOT / 'data'
GUIDES_HTML = ROOT / 'guides.html'
BASE_URL = 'https://campmate.kangseyoung7.workers.dev'
VER = '20260315'

TYPE_META = {
    'best-list': {'label': 'Best Lists', 'badge': 'Best List', 'desc': 'Roundups for shoppers who want a shortlist fast.'},
    'comparison': {'label': 'Comparisons', 'badge': 'Comparison', 'desc': 'Head-to-head guides that compare two brands or products.'},
    'how-to': {'label': 'How-to Guides', 'badge': 'How-to Guide', 'desc': 'Step-by-step help for choosing the right camping gear.'},
    'guide': {'label': 'More Guides', 'badge': 'Guide', 'desc': 'Extra buyer guides and supporting editorial pages.'},
}
CATEGORY_META = [
    ('general', 'General Camping', ['camping gear', 'gear brands', 'brands', 'family camping', 'budget camping']),
    ('tents', 'Tents', ['tent', 'tents', 'swag', 'swags']),
    ('chairs', 'Chairs', ['chair', 'chairs', 'helinox']),
    ('coolers', 'Coolers', ['cooler', 'coolers', 'ice box', 'ice boxes', 'fridge', 'fridges']),
    ('stoves', 'Stoves', ['stove', 'stoves', 'jetboil', 'camp chef', 'soto']),
    ('lanterns', 'Lanterns', ['lantern', 'lanterns', 'lighting']),
    ('sleep-systems', 'Sleep Systems', ['sleep', 'sleeping', 'mat', 'mats', 'mattress', 'mattresses', 'bag', 'bags', 'quilt', 'quilts']),
]


def read_guide(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', text, re.S | re.I)
    desc_match = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', text, re.I)
    title = re.sub(r'\s+', ' ', (title_match.group(1) if title_match else path.stem.replace('-', ' ').title())).strip()
    desc = re.sub(r'\s+', ' ', (desc_match.group(1) if desc_match else '')).strip()
    slug = path.stem
    lower_title = title.lower()
    if slug.startswith('top-10-') or lower_title.startswith('top 10') or lower_title.startswith('best '):
        gtype = 'best-list'
    elif lower_title.startswith('how to '):
        gtype = 'how-to'
    elif '-vs-' in slug or ' vs ' in lower_title:
        gtype = 'comparison'
    else:
        gtype = 'guide'
    category_slug, category_label = infer_category(title, desc)
    excerpt = desc or default_excerpt(gtype)
    return {
        'slug': slug,
        'title': title,
        'excerpt': excerpt,
        'type': gtype,
        'typeLabel': TYPE_META[gtype]['badge'],
        'category': category_slug,
        'categoryLabel': category_label,
    }


def infer_category(title: str, desc: str):
    text = f'{title} {desc}'.lower()
    if any(word in text for word in ['camping gear', 'gear brands', 'brands australia', 'budget camping']):
        return 'general', 'General Camping'
    for slug, label, keywords in CATEGORY_META:
        if any(keyword in text for keyword in keywords):
            return slug, label
    return 'general', 'General Camping'


def default_excerpt(gtype: str) -> str:
    if gtype == 'comparison':
        return 'Head-to-head comparison guide designed to lead into CampMate compare pages.'
    if gtype == 'how-to':
        return 'Step-by-step buying guide for Australian camping conditions.'
    return 'Buyer-first guide designed to lead into CampMate comparison and shortlist pages.'


def write_json(guides):
    DATA_DIR.mkdir(exist_ok=True)
    basic = [{'slug': g['slug'], 'title': g['title'], 'excerpt': g['excerpt'], 'type': g['type'], 'category': g['category']} for g in guides]
    detailed = basic
    (DATA_DIR / 'guides.json').write_text(json.dumps(basic, ensure_ascii=False, indent=2), encoding='utf-8')
    (DATA_DIR / 'guides_index.json').write_text(json.dumps(detailed, ensure_ascii=False, indent=2), encoding='utf-8')


def section_html(section_key: str, items: list[dict]) -> str:
    meta = TYPE_META[section_key]
    cards = []
    for item in items:
        cards.append(f'''<article class="card">
  <div class="card-body">
    <div class="metric-row" style="justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px">
      <span class="badge">{item['typeLabel']}</span>
      <span class="soft-badge">{item['categoryLabel']}</span>
    </div>
    <a class="title" href="/guides/{item['slug']}">{item['title']}</a>
    <p class="muted" style="margin:8px 0 14px;font-size:.92rem">{item['excerpt']}</p>
    <a class="btn small" href="/guides/{item['slug']}">Read guide</a>
  </div>
</article>''')
    return f'''<section class="section" id="{section_key}" style="padding-top:10px">
  <div class="section-head">
    <div>
      <h2>{meta['label']}</h2>
      <p>{meta['desc']}</p>
    </div>
    <div class="metric-row"><span class="metric-chip good">{len(items)} guides</span></div>
  </div>
  <div class="grid-3">
    {''.join(cards)}
  </div>
</section>'''


def build_page(guides: list[dict]) -> str:
    counts = defaultdict(int)
    for guide in guides:
        counts[guide['type']] += 1
    ordered_types = ['best-list', 'comparison', 'how-to']
    sections = []
    for key in ordered_types:
        items = sorted([g for g in guides if g['type'] == key], key=lambda x: x['title'].lower())
        if items:
            sections.append(section_html(key, items))
    extra = sorted([g for g in guides if g['type'] not in ordered_types], key=lambda x: x['title'].lower())
    if extra:
        sections.append(section_html('guide', extra))
    featured_categories = []
    for slug, label, _ in CATEGORY_META:
        total = sum(1 for g in guides if g['category'] == slug)
        if total:
            featured_categories.append(f'<span class="soft-badge">{label} · {total}</span>')
    jump_links = ''.join(
        f'<a class="btn secondary small" href="#{key}">{TYPE_META[key]["label"]}</a>'
        for key in ordered_types if counts.get(key)
    )
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Camping Buying Guides | CampMate Australia</title>
<meta name="description" content="Browse {len(guides)} CampMate buying guides for tents, chairs, coolers, stoves, lanterns and sleep systems in Australia.">
<link rel="canonical" href="{BASE_URL}/guides">
<meta property="og:title" content="Camping Buying Guides | CampMate Australia">
<meta property="og:description" content="Browse {len(guides)} CampMate buying guides grouped by guide type.">
<meta property="og:type" content="website">
<meta property="og:url" content="{BASE_URL}/guides">
<meta name="twitter:card" content="summary_large_image">
<meta name="google-site-verification" content="FYOS27d6BEVJvMcO6uM-zBCBEWVeriEPClO6j2-X6uY">
<meta name="commission-factory-verification" content="ff3f890461734249a17c395d968021a8">
<link rel="stylesheet" href="assets/style.css?v={VER}">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RRL35ZW8MO"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-RRL35ZW8MO');</script>
</head><body>
<header class="topbar"><div class="container nav">
<a class="logo" href="/"><span class="logo-badge">⛺</span><span>CampMate Australia</span></a>
<nav class="nav-links"><a href="/">Home</a><a href="/categories">Categories</a><a href="/popular">Popular</a><a href="/guides" class="active">Guides</a></nav>
<form class="nav-search" action="/search" method="get"><input class="input" name="q" placeholder="Search tents, coolers, chairs..."><button class="btn" type="submit">Search</button></form>
</div></header>
<main class="page-hero"><div class="container">
<div class="breadcrumb"><a href="/">Home</a> · <span>Guides</span></div>
<section class="section" style="padding-top:12px">
  <div class="section-head">
    <div>
      <h1>CampMate guides</h1>
      <p>{len(guides)} buyer-first guides grouped by type, so shoppers can jump straight to best lists, comparisons or how-to help.</p>
    </div>
    <div class="metric-row">
      <span class="metric-chip good">{counts['comparison']} comparisons</span>
      <span class="metric-chip">{counts['best-list']} best lists</span>
      <span class="metric-chip">{counts['how-to']} how-to guides</span>
    </div>
  </div>
  <div class="card" style="margin-bottom:18px"><div class="card-body">
    <div class="metric-row" style="margin-bottom:10px">{jump_links}</div>
    <div class="metric-row">{''.join(featured_categories)}</div>
  </div></div>
  {''.join(sections)}
</section>
</div></main>
<footer class="footer"><div class="container footer-grid">
<div><div class="logo" style="margin-bottom:12px"><span class="logo-badge">⛺</span><span>CampMate Australia</span></div>
<p>CampMate is an all-in-one camping gear comparison site for Australia. Browse categories, compare prices, and open live store searches before you buy.</p>
<p class="muted" style="margin-top:12px">Disclosure: CampMate may earn commissions from affiliate links at no additional cost to you.</p></div>
<div><strong>Browse</strong><div class="list" style="margin-top:12px"><a href="/categories">All categories</a><a href="/popular">Popular compare pages</a><a href="/guides">Buyer guides</a></div></div>
<div><strong>Trust &amp; contact</strong><div class="list" style="margin-top:12px"><a href="/about">About</a><a href="/contact">Contact</a><a href="/disclosure">Affiliate disclosure</a><a href="/privacy">Privacy</a></div></div>
</div></footer>
</body></html>'''


def main():
    guides = [read_guide(path) for path in sorted(GUIDES_DIR.glob('*.html'))]
    guides.sort(key=lambda g: (g['type'] != 'best-list', g['type'] != 'comparison', g['title'].lower()))
    write_json(guides)
    GUIDES_HTML.write_text(build_page(guides), encoding='utf-8')
    print(f'Rebuilt guides landing page with {len(guides)} guides')


if __name__ == '__main__':
    main()
