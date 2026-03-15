import json
import sys
from pathlib import Path

from catalog_rules import is_relevant_product, normalize_product_payload

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data'
SOURCE = DATA_DIR / 'products_source.json'
BUILD_SCRIPT = ROOT / 'scripts' / 'build_products_json.py'


def main():
    if not SOURCE.exists():
        print('products_source.json not found')
        return 1
    products = json.loads(SOURCE.read_text(encoding='utf-8'))
    cleaned = []
    removed = []
    recategorized = []
    seen = set()
    for item in products:
        original_category = item.get('category') or 'tents'
        item = normalize_product_payload(item, original_category)
        if item.get('category') != original_category:
            recategorized.append((item.get('name') or item.get('title') or 'Unknown', original_category, item.get('category')))
        if not is_relevant_product(item, item.get('category') or original_category):
            removed.append(item.get('name') or item.get('title') or 'Unknown')
            continue
        key = (
            str(item.get('sourceItemId') or item.get('sourceLegacyItemId') or ''),
            str(item.get('image') or item.get('ebayImage') or ''),
            str(item.get('name') or ''),
            str(item.get('category') or ''),
        )
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(item)
    SOURCE.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Cleaned source catalog: kept {len(cleaned)}, removed {len(removed)} junk items, recategorized {len(recategorized)} items')
    if recategorized:
        for name, old, new in recategorized[:20]:
            print(f'  {old} -> {new}: {name}')
    import subprocess
    completed = subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=str(ROOT), text=True)
    return completed.returncode


if __name__ == '__main__':
    raise SystemExit(main())
