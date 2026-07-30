# 상품 사진을 eBay 밖 웹 전체에서도 찾아오게 하기 (선택사항)

지금은 `sync_product_images_ebay.py`가 **eBay 매물 사진만** 검색합니다. eBay에 좋은 매물이 없을 때
(신제품이라 매물이 적거나, 있는 매물 사진 품질이 나쁠 때) 구글 이미지 검색으로 대체 사진을 찾아오게
하려면, 아래 절차로 API 키 2개를 발급받아 GitHub Secrets에 등록하면 됩니다. **직접 하셔야 하는
부분입니다** — 구글 계정 인증/과금 설정이 필요해서 저는 대신 만들 수 없어요.

## 1. Programmable Search Engine 만들기 (검색엔진 ID = `GOOGLE_CSE_ID`)

1. https://programmablesearchengine.google.com/ 접속 후 로그인
2. "추가" 클릭 → 검색 대상을 **"전체 웹 검색"**으로 설정(특정 사이트만 검색 아님)
3. 만들어진 검색엔진 설정에서 **"이미지 검색" 켜기**(기본은 꺼져있음)
4. "검색엔진 ID" 복사 (예: `a1b2c3d4e5f6g7h8i`) — 이게 `GOOGLE_CSE_ID`

## 2. Custom Search API 키 발급 (`GOOGLE_API_KEY`)

1. https://console.cloud.google.com/ 에서 프로젝트 생성(또는 기존 프로젝트 사용)
2. "API 및 서비스" → "라이브러리"에서 **"Custom Search API"** 검색해서 사용 설정
3. "사용자 인증 정보" → "사용자 인증 정보 만들기" → "API 키"
4. 만들어진 키를 "Custom Search API"에만 쓰도록 제한(보안 권장) 후 복사 — 이게 `GOOGLE_API_KEY`

**요금**: 하루 100건까지 무료, 그 이후는 1,000건당 $5(하루 최대 10,000건). 지금 설정은 하루 최대
60개 상품만 이미지 동기화하고, eBay에서 이미 좋은 사진을 찾으면 구글 검색은 건너뛰므로 실제
사용량은 무료 한도 안에서 충분히 돌아갈 가능성이 높습니다.

## 3. GitHub Secrets에 등록

이 저장소(`panth0m/campmate`) → Settings → Secrets and variables → Actions → "New repository secret"
- `GOOGLE_API_KEY` = 2번에서 복사한 키
- `GOOGLE_CSE_ID` = 1번에서 복사한 검색엔진 ID

**TechTree 저장소(`panth0m/TechTree`)에도 똑같이 등록해야** 그쪽도 적용됩니다(검색엔진은 "전체 웹"
설정이라 하나를 두 저장소에 같은 값으로 등록해도 되고, 따로 만들어도 됩니다).

## 등록 안 하면 어떻게 되나요?

아무 문제 없습니다 — `sync_product_images_ebay.py`가 키가 없으면 알림 로그만 남기고 자동으로
eBay 검색만 계속 사용합니다(에러 없이 안전하게 폴백).
