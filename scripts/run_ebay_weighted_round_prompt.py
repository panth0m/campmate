from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def ask(prompt: str, default: str) -> str:
    raw = input(f"{prompt} [{default}]: ").strip()
    return raw or default


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    target = root / "scripts" / "run_ebay_weighted_round.py"

    print("=" * 44)
    print("CampMate eBay weighted round importer")
    print("Tents/Chairs priority + incremental resume")
    print("=" * 44)
    print()

    if not target.exists():
        print(f"Missing file: {target}")
        return 1

    total = ask("How many NEW products to try this run across ALL categories?", "120")
    per_request = ask("eBay page size per request (1-200)", "100")

    try:
        total_i = int(total)
        per_i = int(per_request)
        if total_i <= 0:
            raise ValueError
        if not (1 <= per_i <= 200):
            raise ValueError
    except ValueError:
        print("Invalid number input. total must be > 0 and per-request must be 1-200.")
        return 1

    cmd = [
        sys.executable,
        str(target),
        "--total",
        str(total_i),
        "--per-request",
        str(per_i),
    ]

    print()
    print("Running:")
    print(" ".join(cmd))
    print()

    try:
        result = subprocess.run(cmd, cwd=str(root))
        return int(result.returncode or 0)
    except FileNotFoundError as exc:
        print(f"Failed to start Python command: {exc}")
        return 1
    except Exception as exc:
        print(f"Unexpected error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
