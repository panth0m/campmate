from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

try:
    from run_ebay_weighted_round import run_round, SUMMARY_FILE
except Exception as e:
    print(f"ERROR: Could not load weighted round importer: {e}")
    raise SystemExit(1)


def ask_int(prompt: str, default: int, minimum: int, maximum: int) -> int:
    raw = input(f"{prompt} [{default}]: ").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        print(f"Invalid number: {raw}")
        raise SystemExit(1)
    if value < minimum or value > maximum:
        print(f"Value must be between {minimum} and {maximum}.")
        raise SystemExit(1)
    return value


def main() -> int:
    print("=" * 44)
    print("CampMate eBay weighted round importer")
    print("Tents/Chairs priority + incremental resume")
    print("=" * 44)
    print()

    total = ask_int("How many NEW products to try this run across ALL categories?", 120, 1, 10000)
    per_request = ask_int("eBay page size per request (1-200)", 100, 1, 200)

    try:
        result = run_round(total, per_request, no_detail=False)
    except Exception as e:
        print(f"ERROR: {e}")
        return 1

    print()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()
    print(f"Done. Summary saved to {SUMMARY_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
