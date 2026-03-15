#!/usr/bin/env python3
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
GUIDES_DIR = ROOT / 'guides'
PRODUCTS_DIR = ROOT / 'products'
BASE_URL = 'https://campmate.kangseyoung7.workers.dev'
TODAY = date.today().isoformat()

MAIN_ROUTES = [
    ('', 'weekly', '1.0'),
    ('/categories', 'weekly', '0.9'),
    ('/popular', 'weekly', '0.8'),
    ('/guides', 'weekly', '0.9'),
    ('/tents', 'weekly', '0.9'),
    ('/chairs', 'weekly', '0.9'),
    ('/coolers', 'weekly', '0.9'),
    ('/stoves', 'weekly', '0.9'),
    ('/lanterns', 'weekly', '0.8'),
    ('/sleeping-bags', 'weekly', '0.8'),
    ('/about', 'monthly', '0.4'),
    ('/contact', 'monthly', '0.4'),
    ('/disclosure', 'monthly', '0.3'),
    ('/privacy', 'monthly', '0.3'),
]


def url_entry(path: str, changefreq: str, priority: str) -> str:
    loc = BASE_URL if not path else f'{BASE_URL}{path}'
    return f'''  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>{changefreq}</changefreq>\n    <priority>{priority}</priority>\n  </url>'''


def write_urlset(filename: str, entries: list[str]):
    content = '<?xml version="1.0" encoding="utf-8"?>\n' \
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(entries) + '\n</urlset>\n'
    (ROOT / filename).write_text(content, encoding='utf-8')


def write_index(children: list[str]):
    rows = []
    for child in children:
        rows.append(f'''  <sitemap>\n    <loc>{BASE_URL}/{child}</loc>\n    <lastmod>{TODAY}</lastmod>\n  </sitemap>''')
    content = '<?xml version="1.0" encoding="utf-8"?>\n' \
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</sitemapindex>\n'
    (ROOT / 'sitemap.xml').write_text(content, encoding='utf-8')


def main():
    products = json.loads((DATA / 'products.json').read_text(encoding='utf-8'))
    guides_json = json.loads((DATA / 'guides_index.json').read_text(encoding='utf-8'))

    main_entries = [url_entry(path, freq, prio) for path, freq, prio in MAIN_ROUTES]
    write_urlset('sitemap-main.xml', main_entries)

    guide_slugs = sorted({g.get('slug') for g in guides_json if g.get('slug')})
    guide_entries = [url_entry(f'/guides/{slug}', 'weekly', '0.7') for slug in guide_slugs if (GUIDES_DIR / f'{slug}.html').exists()]
    write_urlset('sitemap-guides.xml', guide_entries)

    product_slugs = sorted({p.get('slug') for p in products if p.get('slug')})
    product_entries = [url_entry(f'/products/{slug}', 'weekly', '0.6') for slug in product_slugs if (PRODUCTS_DIR / f'{slug}.html').exists()]
    write_urlset('sitemap-products.xml', product_entries)

    write_index(['sitemap-main.xml', 'sitemap-guides.xml', 'sitemap-products.xml'])
    print(f'Rebuilt sitemap index with {len(main_entries)} main, {len(guide_entries)} guides, {len(product_entries)} products')


if __name__ == '__main__':
    main()
