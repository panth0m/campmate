from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def ask_int(prompt: str, default: int, minimum: int, maximum: int) -> int:
    while True:
        raw = input(f"{prompt} [{default}]: ").strip()
        if not raw:
            return default
        try:
            value = int(raw)
        except ValueError:
            print("Please enter a number.")
            continue
        if value < minimum or value > maximum:
            print(f"Please enter a value between {minimum} and {maximum}.")
            continue
        return value


def main() -> int:
    print("=" * 42)
    print("CampMate eBay weighted round importer")
    print("Tents/Chairs priority + incremental resume")
    print("=" * 42)
    print()

    total = ask_int(
        "How many NEW products to try this run across ALL categories?", 120, 1, 5000
    )
    per_request = ask_int("eBay page size per request (1-200)", 100, 1, 200)

    root = Path(__file__).resolve().parents[1]
    runner = root / "scripts" / "run_ebay_weighted_round.py"
    if not runner.exists():
        print(f"ERROR: Could not find {runner}")
        return 1

    cmd = [
        sys.executable,
        str(runner),
        "--total",
        str(total),
        "--per-request",
        str(per_request),
    ]

    print()
    print("Running:")
    print(" ".join(f'"{part}"' if " " in part else part for part in cmd))
    print()

    completed = subprocess.run(cmd, cwd=str(root))
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
