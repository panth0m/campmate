#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
products = json.loads((ROOT / "data" / "products_source.json").read_text(encoding="utf-8"))
rows = []
for product in products:
    if product.get("category") != "tents":
        continue
    for store in product.get("stores", []):
        price = store.get("price")
        try:
            price = float(price) if price is not None else None
        except (TypeError, ValueError):
            price = None
        rows.append({
            "slug": product.get("slug", ""),
            "product": product.get("name", ""),
            "brand": product.get("brand", ""),
            "store": store.get("name", ""),
            "price_aud": price,
            "matched_url": store.get("matchedUrl", ""),
            "availability": store.get("availability", ""),
            "match_type": store.get("matchType", ""),
            "checked_at": store.get("priceCheckedAt", ""),
        })
out = ROOT / "data" / "tent_research_current_state_20260821.csv"
with out.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(f"wrote {len(rows)} retailer rows to {out}")
