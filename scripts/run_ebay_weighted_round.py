import argparse
import json
import math
from pathlib import Path
from typing import Dict, List, Tuple

from import_ebay_incremental import incremental_import, load_env, write_json, read_json

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PLAN_FILE = DATA_DIR / "ebay_weighted_round.json"
SUMMARY_FILE = DATA_DIR / "ebay_weighted_round_last_run.json"

DEFAULT_ORDER = ["tents", "chairs", "coolers", "stoves", "lanterns", "sleep-systems"]


def normalize_order(plan: Dict) -> List[str]:
    order = plan.get("order") or DEFAULT_ORDER
    return [x for x in order if x in DEFAULT_ORDER] + [x for x in DEFAULT_ORDER if x not in order]


def allocate(total: int, weights: Dict[str, float], mins: Dict[str, int], order: List[str]) -> Dict[str, int]:
    active = [c for c in order if weights.get(c, 0) > 0]
    if not active:
        raise RuntimeError("No active categories in ebay_weighted_round.json")
    mins = {c: max(0, int(mins.get(c, 0))) for c in active}
    base = sum(mins.values())
    if base > total:
        # scale down mins proportionally if total is smaller than the minimum plan
        ratio = total / base if base else 0
        alloc = {c: int(mins[c] * ratio) for c in active}
    else:
        alloc = {c: mins[c] for c in active}
        remaining = total - base
        weight_sum = sum(float(weights.get(c, 0)) for c in active)
        raw_extra: List[Tuple[str, float]] = []
        used = 0
        for c in active:
            extra = (remaining * float(weights.get(c, 0)) / weight_sum) if weight_sum else 0
            whole = int(math.floor(extra))
            alloc[c] += whole
            used += whole
            raw_extra.append((c, extra - whole))
        left = remaining - used
        for c, _frac in sorted(raw_extra, key=lambda x: x[1], reverse=True):
            if left <= 0:
                break
            alloc[c] += 1
            left -= 1
    return {c: alloc.get(c, 0) for c in order if alloc.get(c, 0) > 0}


def run_round(total: int, per_request: int, no_detail: bool = False) -> Dict:
    load_env()
    plan = read_json(PLAN_FILE, {})
    weights = plan.get("weights") or {
        "tents": 36,
        "chairs": 24,
        "coolers": 12,
        "stoves": 10,
        "lanterns": 10,
        "sleep-systems": 8,
    }
    mins = plan.get("minimums") or {
        "tents": 30,
        "chairs": 20,
        "coolers": 10,
        "stoves": 8,
        "lanterns": 8,
        "sleep-systems": 6,
    }
    order = normalize_order(plan)
    allocation = allocate(total, weights, mins, order)

    summary = {
        "requested_total": total,
        "per_request": per_request,
        "allocation": allocation,
        "results": [],
        "added_total": 0,
    }

    for category in order:
        qty = allocation.get(category, 0)
        if qty <= 0:
            continue
        try:
            result = incremental_import(category, qty, per_request, detail_mode=not no_detail)
        except Exception as e:
            result = {
                "category": category,
                "requested": qty,
                "added": 0,
                "error": str(e),
            }
        summary["results"].append(result)
        summary["added_total"] += int(result.get("added") or 0)

    write_json(SUMMARY_FILE, summary)
    return summary


def main():
    parser = argparse.ArgumentParser(description="Run one weighted eBay AU import round across all CampMate categories")
    parser.add_argument("--total", type=int, default=120, help="Total new items to try adding across all categories")
    parser.add_argument("--per-request", "--page-size", dest="per_request", type=int, default=100, help="eBay page size for each request (1-200)")
    parser.add_argument("--no-detail", action="store_true", help="Skip getItem enrichment for speed")
    args = parser.parse_args()

    if args.total < 1:
        raise SystemExit("--total must be at least 1")
    if args.per_request < 1 or args.per_request > 200:
        raise SystemExit("--per-request must be between 1 and 200")

    result = run_round(args.total, args.per_request, no_detail=args.no_detail)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
