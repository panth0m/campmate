import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
artifacts = root / "artifacts"
base_path = root / "data" / "products_source.json"
products = json.loads(base_path.read_text(encoding="utf-8"))
by_slug = {p.get("slug"): p for p in products}
merged = {}

for source_path in sorted(artifacts.glob("**/products_source.json")):
    store_seen = 0
    store_name = source_path.parent.parent.name.removeprefix("retailer-")
    incoming = json.loads(source_path.read_text(encoding="utf-8"))
    for product in incoming:
        target = by_slug.get(product.get("slug"))
        if not target:
            continue
        target_stores = {s.get("name"): s for s in target.get("stores", [])}
        for incoming_store in product.get("stores", []):
            name = incoming_store.get("name")
            if not name or name not in target_stores:
                continue
            if name == store_name or incoming_store.get("price") or incoming_store.get("matchedUrl"):
                destination = target_stores[name]
                for key in ("price", "matchedUrl", "priceCheckedAt"):
                    if key in incoming_store:
                        destination[key] = incoming_store[key]
                    elif key in ("price", "matchedUrl") and name == store_name:
                        destination.pop(key, None)
                store_seen += 1
    merged[store_name] = store_seen

base_path.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"stores": merged, "products": len(products)}, ensure_ascii=False))
