"""스크래핑으로 얻은 매장 가격을 최신 products_source.json 위에 필드 단위로 다시 얹는다.

배경: products_source.json / products.json 은 워크플로가 매번 파일 전체를 다시 쓰기 때문에,
다른 워크플로(Daily eBay Import 등)가 같은 파일을 먼저 커밋하면 git rebase 가 내용 충돌로 죽는다.
가격은 '상품 slug + 매장 이름' 단위로만 바뀌는 값이므로, 파일을 통째로 합치는 대신
최신 파일을 기준으로 가격 필드만 다시 얹으면 충돌이 생기지 않는다.

사용:
  python merge_price_results.py --scraped /tmp/scraped.json --target data/products_source.json
"""
import argparse
import json
from pathlib import Path

PRICE_KEYS = ("price", "matchedUrl", "priceCheckedAt")


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scraped", required=True, help="이번 실행이 스크래핑한 products_source.json")
    ap.add_argument("--target", required=True, help="origin/main 최신 products_source.json (덮어쓴다)")
    args = ap.parse_args()

    scraped = load(args.scraped)
    target = load(args.target)

    by_slug = {p.get("slug"): p for p in target if p.get("slug")}
    applied = skipped = 0

    for sp in scraped:
        tp = by_slug.get(sp.get("slug"))
        if not tp:
            skipped += 1          # eBay Import 가 그 사이 지운 상품
            continue
        tstores = {s.get("name"): s for s in (tp.get("stores") or [])}
        for ss in sp.get("stores") or []:
            ts = tstores.get(ss.get("name"))
            if not ts:
                continue
            if any(k in ss for k in PRICE_KEYS):
                for k in PRICE_KEYS:
                    if k in ss:
                        ts[k] = ss[k]
                    else:
                        ts.pop(k, None)
                applied += 1

    Path(args.target).write_text(
        json.dumps(target, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"merged store prices: applied={applied} skipped_products={skipped} "
          f"products={len(scraped)}→{len(target)}")


if __name__ == "__main__":
    main()
