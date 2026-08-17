#!/usr/bin/env python3
"""Match retailer listings to exact or equivalent CampMate products.

Matching policy:
- Exact: same brand and strong model/title overlap.
- Equivalent: same product family/category with compatible capacity/size/function tokens.
- Never match obvious accessories, parts, bundles, or incompatible capacities.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from difflib import SequenceMatcher

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data/products_source.json"
MARKET = Path("/home/ubuntu/parsed_market_latest.json")
OUT = ROOT / "data/equivalent_matches_preview.json"

STOP = {"the","and","for","with","from","series","camping","outdoor","australia","new","tent","stove","system","set","gear","product"}
EXCLUDE = {"cover","protector","cord","case","bag","replacement","parts","spare","floor","accessory","support","lifter","handle","packaging","stand","stool"}
FAMILY = {
    "stoves": {"stove","cooker","cooking","burner","jetboil","trangia","pocketrocket","windburner"},
    "tents": {"tent","dome","instant","shelter","awning"},
    "coolers": {"fridge","cooler","ice","freezer"},
    "cookware": {"cookset","pot","oven","campfire","cast","pan"},
    "chairs": {"chair","seat","recliner","stool"},
}

def norm(s: str) -> str:
    s = s.lower().replace("−", "-")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def tokens(s: str) -> set[str]:
    return {t for t in norm(s).split() if len(t) > 1 and t not in STOP}

def numbers(s: str) -> set[str]:
    return set(re.findall(r"\b\d+(?:\.\d+)?\b", s.lower()))

def capacity(s: str) -> set[str]:
    s = s.lower()
    vals = set(re.findall(r"\b\d+\s*(?:p|person|people|l|litre|liter|q|qt|ml|g|kg)\b", s))
    vals |= {f"{x}p" for x in re.findall(r"\b(\d+)\s*(?:person|people)\b", s)}
    return vals

def category(p: dict) -> str:
    c = str(p.get("category", "")).lower()
    if c in {"stoves", "tents", "coolers", "cookware", "chairs"}: return c
    text = norm(" ".join([str(p.get("name", "")), str(p.get("summary", ""))]))
    for k, words in FAMILY.items():
        if any(w in text.split() for w in words): return k
    return "other"

def score(p: dict, r: dict) -> tuple[float, str, list[str]]:
    ptext = f"{p.get('brand','')} {p.get('name','')} {p.get('summary','')} {p.get('description','')}"
    rtitle = str(r.get("title", ""))
    pt, rt = tokens(ptext), tokens(rtitle)
    if not rt or any(x in norm(rtitle).split() for x in EXCLUDE): return (0, "excluded", [])
    pc, rc = category(p), category({"name": rtitle, "category": ""})
    if pc == "other" or rc == "other" or pc != rc: return (0, "category_mismatch", [])
    overlap = pt & rt
    base = len(overlap) / max(1, min(len(pt), len(rt)))
    brand = norm(str(p.get("brand", ""))) in norm(rtitle).split()
    cap_p = capacity(ptext)
    cap_r = capacity(rtitle)
    if cap_p and cap_r and cap_p.isdisjoint(cap_r): return (0, "capacity_mismatch", [])
    if cap_p & cap_r: base += 0.20
    if brand: base += 0.18
    family_hits = len((FAMILY.get(pc, set()) & rt))
    if family_hits == 0: return (0, "family_mismatch", [])
    base += min(0.18, family_hits * 0.04)
    title_sim = SequenceMatcher(None, norm(str(p.get("name", ""))), norm(rtitle)).ratio()
    base += title_sim * 0.20
    label = "exact" if brand and title_sim >= 0.70 and base >= 0.90 else "equivalent" if base >= 0.42 else "weak"
    evidence = sorted(overlap | (cap_p & cap_r))
    return (round(min(base, 1.0), 3), label, evidence)

def main():
    products = json.loads(PRODUCTS.read_text())
    market = json.loads(MARKET.read_text())
    rows = []
    for store, listings in market.items():
        for listing in listings:
            try: price = float(re.sub(r"[^0-9.]", "", str(listing.get("price", ""))))
            except ValueError: continue
            if price <= 0 or str(listing.get("condition", "")).lower().startswith("used"): continue
            ranked = []
            for p in products:
                s, label, evidence = score(p, listing)
                if s >= 0.42: ranked.append((s, label, evidence, p))
            ranked.sort(key=lambda x: x[0], reverse=True)
            if ranked:
                s, label, evidence, p = ranked[0]
                rows.append({"retailer": store, "listing": listing, "productSlug": p["slug"], "productName": p["name"], "matchType": label, "score": s, "evidence": evidence})
    OUT.write_text(json.dumps({"generatedAt":"2026-08-17T00:00:00Z", "matches": rows}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"matches": len(rows), "exact": sum(x["matchType"] == "exact" for x in rows), "equivalent": sum(x["matchType"] == "equivalent" for x in rows), "output": str(OUT)}, ensure_ascii=False))

if __name__ == "__main__": main()
