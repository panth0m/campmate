
(function(){
  const STORAGE_KEY = 'campmate_lang';
  const SUPPORTED = { en:'AU EN', ko:'KR 한국어', ja:'JP 日本語', zh:'CN 中文' };
  const LOCALES = { en:'en-AU', ko:'ko-KR', ja:'ja-JP', zh:'zh-CN' };
  const DEFAULT_LANG = 'en';

  const dict = {
    en: {
      home:'Home', categories:'Categories', popular:'Popular', guides:'Guides', search:'Search',
      browse:'Browse', open:'Open', products:'products', reviews:'reviews', stores:'stores',
      compare_prices:'Compare page', compare_stores:'Compare stores', category_page:'Category page',
      all_categories:'All categories', popular_products:'Popular products', seo_guides:'SEO guides',
      cloudflare_ready:'Cloudflare Pages ready', local_images:'Local product images included', ebay_live:'eBay live via /api/ebay-search',
      filter_products:'Filter products in this category', featured:'Featured', lowest_price:'Lowest price', highest_price:'Highest price', highest_rating:'Highest rating',
      no_active_filters:'No active filters', clear_all:'Clear all', loading:'Loading…',
      browse_all_categories:'Browse all categories', category_not_found:'Category not found', no_category_found:'No category found.', failed_to_load:'Failed to load',
      could_not_load_products:'Could not load products. Make sure you are running this on a web server (not opening the file directly).',
      no_products_match:'No products match this filter.', no_matching_products:'No matching products found.',
      search_results:'Search results', type_product:'Type a product, brand or category.',
      popular_heading:'Popular products', popular_copy:'High-rated compare pages designed for product discovery and affiliate clicks.',
      categories_heading:'All categories', categories_copy:'Start with a category page, then open product pages for comparisons and store links.',
      compare_site_footer:'AllIn camping gear compare for Australia. Compare categories first, then open product pages and click through honest store links.',
      review_first:'Review first. Compare next.',
      home_h1:'Australian camping gear picks that lead into simple price comparison.',
      home_p:'CampMate is designed to start like a useful buying guide and grow into a stronger comparison site over time. Browse category pages, open product pages and check current store listings before you click through.',
      start_guides:'Start with guides', browse_categories:'Browse categories', review_led:'Review-led content', compare_pages:'Compare pages', live_ebay:'Live eBay listings', affiliate_ready:'Affiliate-ready',
      how_it_works:'How CampMate works', how_it_works_p:'Start with helpful guide content, then move into comparison pages when you are ready to buy.',
      step1:'Step 1', step2:'Step 2', step3:'Step 3', read_guide:'Read guide', open_product_page:'Open a product page', click_through_stores:'Click through to stores',
      step1_p:'Use review-style guide pages to shortlist tents, chairs, stoves, lanterns and cooler options for your trip style.',
      step2_p:'Each product page gives you a simple summary, store compare links and current eBay marketplace listings when available.',
      step3_p:'When a product looks right, open the store listing and continue your purchase directly on the retailer marketplace.',
      featured_paths:'Featured guide paths', featured_paths_p:'These pages are the best entry points for search traffic and first-time visitors.', all_guides:'All guides',
      read_more:'Read more', view_disclosure:'View disclosure', trust_heading:'Trust and transparency', trust_p:'Small pages like these help the site look more complete for users, partners and search engines.',
      compare_pages_intro:'These are still useful for visitors who already know what category they want.', all_products:'All products',
      updated_from_catalogue:'Updated from the current CampMate catalogue.', core_categories:'Core categories', max_store_options:'Max store options', top_current_brand:'Top current brand', what_changed:'What changed',
      product:'Product', products_nav:'Products', review_to_compare:'Review to compare page', shop_links_compare:'Shop links and price compare',
      shop_links_note:'CampMate shows store search links and live marketplace results so shoppers can compare before buying.',
      why_page_exists:'Why this page exists', why_page_exists_p:'CampMate uses product pages as simple buying checkpoints: see the basics, compare store options and then open trusted retailer links.',
      current_ebay:'Current eBay listings', loading_ebay:'Loading live eBay results…', loading_ebay_p:'This may take a few seconds on first load.',
      view_on_ebay:'View on eBay', affiliate_note:'Affiliate note', affiliate_note_p:'Some outbound links on CampMate may be affiliate links. That does not change the price you pay.',
      read_disclosure:'Read disclosure', about:'About', about_campmate:'About CampMate', contact:'Contact', affiliate_disclosure:'Affiliate disclosure',
      about_footer:'CampMate helps Australian campers discover useful gear, compare current listings and click through to trusted stores.',
      disclosure_footer:'Disclosure: CampMate may earn commissions from affiliate links at no additional cost to you.',
      no_store_links:'No store links yet', add_retailer_links:'Add retailer search links in products.json.', search_store:'Search store',
      result_for:'{count} result(s) for “{query}”', continue_to:'Continue to {category}',
      category_snapshot:'Category snapshot', top_brands:'Top brands'
    },
    ko: {
      home:'홈', categories:'카테고리', popular:'인기', guides:'가이드', search:'검색',
      browse:'보기', open:'열기', products:'개', reviews:'리뷰', stores:'판매처',
      compare_prices:'비교 페이지', compare_stores:'판매처 비교', category_page:'카테고리 페이지',
      all_categories:'전체 카테고리', popular_products:'인기 상품', seo_guides:'SEO 가이드',
      cloudflare_ready:'Cloudflare Pages 배포 준비됨', local_images:'로컬 상품 이미지 포함', ebay_live:'eBay 실시간 연동 (/api/ebay-search)',
      filter_products:'이 카테고리 내 상품 검색', featured:'추천순', lowest_price:'최저가순', highest_price:'최고가순', highest_rating:'평점순',
      no_active_filters:'적용된 필터 없음', clear_all:'모두 지우기', loading:'불러오는 중…',
      browse_all_categories:'전체 카테고리 보기', category_not_found:'카테고리를 찾을 수 없음', no_category_found:'카테고리를 찾지 못했습니다.', failed_to_load:'불러오기 실패',
      could_not_load_products:'상품을 불러오지 못했습니다. 파일 직접 열기 대신 웹서버에서 실행해 주세요.',
      no_products_match:'필터와 일치하는 상품이 없습니다.', no_matching_products:'일치하는 상품이 없습니다.',
      search_results:'검색 결과', type_product:'상품명, 브랜드 또는 카테고리를 입력하세요.',
      popular_heading:'인기 상품', popular_copy:'상품 탐색과 제휴 클릭에 유리한 고평점 비교 페이지입니다.',
      categories_heading:'전체 카테고리', categories_copy:'카테고리부터 시작한 뒤 상품 페이지에서 비교와 스토어 링크를 확인하세요.',
      compare_site_footer:'AllIn 호주 캠핑 장비 비교 사이트입니다. 먼저 카테고리를 비교하고, 상품 페이지에서 스토어 링크를 확인해 보세요.',
      review_first:'먼저 리뷰, 다음은 비교',
      home_h1:'호주 캠핑 장비를 더 쉽게 고르고, 더 간단하게 비교하세요.',
      home_p:'CampMate는 먼저 유용한 가이드처럼 시작하고, 점점 더 강한 비교 사이트로 발전하도록 설계되었습니다. 카테고리 페이지를 둘러보고, 상품 페이지를 열어 현재 판매처 정보를 확인한 뒤 이동하세요.',
      start_guides:'가이드부터 보기', browse_categories:'카테고리 둘러보기', review_led:'리뷰 중심 콘텐츠', compare_pages:'비교 페이지', live_ebay:'실시간 eBay 시세', affiliate_ready:'제휴 준비 완료',
      how_it_works:'CampMate 사용 방법', how_it_works_p:'도움이 되는 가이드부터 시작하고, 구매할 준비가 되면 비교 페이지로 이동하세요.',
      step1:'1단계', step2:'2단계', step3:'3단계', read_guide:'가이드 읽기', open_product_page:'상품 페이지 열기', click_through_stores:'스토어로 이동',
      step1_p:'리뷰형 가이드를 통해 여행 스타일에 맞는 텐트, 의자, 스토브, 랜턴, 쿨러를 먼저 추려보세요.',
      step2_p:'각 상품 페이지에서는 요약 정보, 판매처 비교 링크, 그리고 가능한 경우 현재 eBay 시세를 확인할 수 있습니다.',
      step3_p:'마음에 드는 상품이 보이면 스토어 링크를 열고 판매처에서 직접 구매를 이어가세요.',
      featured_paths:'추천 가이드 경로', featured_paths_p:'검색 유입과 첫 방문자에게 가장 좋은 시작점입니다.', all_guides:'전체 가이드',
      read_more:'더 보기', view_disclosure:'고지 보기', trust_heading:'신뢰와 투명성', trust_p:'이런 작은 페이지들은 사용자, 제휴사, 검색엔진 모두에게 사이트 완성도를 높여줍니다.',
      compare_pages_intro:'원하는 카테고리를 이미 알고 있는 방문자에게 특히 유용합니다.', all_products:'전체 상품',
      updated_from_catalogue:'현재 CampMate 카탈로그 기준으로 업데이트되었습니다.', core_categories:'핵심 카테고리', max_store_options:'최대 판매처 수', top_current_brand:'현재 최다 브랜드', what_changed:'변경 사항',
      product:'상품', products_nav:'상품', review_to_compare:'리뷰에서 비교로', shop_links_compare:'스토어 링크 및 가격 비교',
      shop_links_note:'CampMate는 스토어 검색 링크와 실시간 마켓플레이스 결과를 보여주어 구매 전 비교를 돕습니다.',
      why_page_exists:'이 페이지가 있는 이유', why_page_exists_p:'CampMate 상품 페이지는 간단한 구매 체크포인트 역할을 합니다. 핵심 정보와 판매처 옵션을 보고 신뢰할 수 있는 스토어로 이동하세요.',
      current_ebay:'현재 eBay 등록 상품', loading_ebay:'실시간 eBay 결과를 불러오는 중…', loading_ebay_p:'첫 로딩에는 몇 초 걸릴 수 있습니다.',
      view_on_ebay:'eBay에서 보기', affiliate_note:'제휴 안내', affiliate_note_p:'CampMate의 일부 외부 링크는 제휴 링크일 수 있습니다. 사용자가 결제하는 가격은 변하지 않습니다.',
      read_disclosure:'고지 읽기', about:'소개', about_campmate:'CampMate 소개', contact:'문의', affiliate_disclosure:'제휴 고지',
      about_footer:'CampMate는 호주 캠핑 이용자가 유용한 장비를 찾고, 현재 판매 정보를 비교한 뒤, 신뢰할 수 있는 스토어로 이동할 수 있도록 돕습니다.',
      disclosure_footer:'고지: CampMate는 제휴 링크를 통해 추가 비용 없이 수수료를 받을 수 있습니다.',
      no_store_links:'아직 스토어 링크가 없습니다', add_retailer_links:'products.json에 판매처 검색 링크를 추가하세요.', search_store:'스토어 검색',
      result_for:'“{query}” 검색 결과 {count}개', continue_to:'{category}(으)로 이동', category_snapshot:'카테고리 요약', top_brands:'주요 브랜드'
    },
    ja: {
      home:'ホーム', categories:'カテゴリー', popular:'人気', guides:'ガイド', search:'検索',
      browse:'見る', open:'開く', products:'件', reviews:'レビュー', stores:'店舗',
      compare_prices:'比較ページ', compare_stores:'店舗比較', category_page:'カテゴリーページ',
      all_categories:'すべてのカテゴリー', popular_products:'人気商品', seo_guides:'SEOガイド',
      cloudflare_ready:'Cloudflare Pages 対応', local_images:'ローカル商品画像あり', ebay_live:'eBay ライブ連携 (/api/ebay-search)',
      filter_products:'このカテゴリー内で商品を絞り込む', featured:'おすすめ順', lowest_price:'価格の安い順', highest_price:'価格の高い順', highest_rating:'評価の高い順',
      no_active_filters:'有効なフィルターはありません', clear_all:'すべてクリア', loading:'読み込み中…',
      browse_all_categories:'すべてのカテゴリーを見る', category_not_found:'カテゴリーが見つかりません', no_category_found:'カテゴリーが見つかりませんでした。', failed_to_load:'読み込み失敗',
      could_not_load_products:'商品を読み込めませんでした。ファイルを直接開かず、Webサーバー上で実行してください。',
      no_products_match:'条件に一致する商品はありません。', no_matching_products:'一致する商品がありません。',
      search_results:'検索結果', type_product:'商品名・ブランド・カテゴリーを入力してください。',
      popular_heading:'人気商品', popular_copy:'商品発見とアフィリエイトクリックに向いた高評価の比較ページです。',
      categories_heading:'すべてのカテゴリー', categories_copy:'カテゴリーから始めて、商品ページで比較とストアリンクを確認してください。',
      compare_site_footer:'AllIn オーストラリア向けキャンプ用品比較サイトです。まずカテゴリーを比べて、その後商品ページからストアへ進めます。',
      review_first:'まずレビュー、次に比較',
      home_h1:'オーストラリアのキャンプ用品を、もっと簡単に選んで比較できます。',
      home_p:'CampMate は、最初は役立つガイドとして機能し、徐々に強力な比較サイトへ成長するよう設計されています。カテゴリーを見て、商品ページを開き、現在のストア情報を確認してから移動できます。',
      start_guides:'ガイドから始める', browse_categories:'カテゴリーを見る', review_led:'レビュー中心', compare_pages:'比較ページ', live_ebay:'eBay ライブ価格', affiliate_ready:'アフィリエイト対応',
      how_it_works:'CampMate の使い方', how_it_works_p:'まず役立つガイドを読み、購入の準備ができたら比較ページへ進みます。',
      step1:'ステップ1', step2:'ステップ2', step3:'ステップ3', read_guide:'ガイドを読む', open_product_page:'商品ページを開く', click_through_stores:'ストアへ進む',
      step1_p:'レビュー形式のガイドで、旅のスタイルに合うテント、チェア、ストーブ、ランタン、クーラーを絞り込みます。',
      step2_p:'各商品ページでは、要約、ストア比較リンク、利用可能な場合は現在の eBay 価格を確認できます。',
      step3_p:'気になる商品があれば、ストアの掲載ページを開いてそのまま購入へ進めます。',
      featured_paths:'おすすめガイド', featured_paths_p:'検索流入や初めての訪問者に最適な入口です。', all_guides:'すべてのガイド',
      read_more:'続きを読む', view_disclosure:'開示を見る', trust_heading:'信頼と透明性', trust_p:'このような小さなページが、ユーザー、提携先、検索エンジンに対する完成度を高めます。',
      compare_pages_intro:'すでに見たいカテゴリーが決まっている訪問者に便利です。', all_products:'すべての商品',
      updated_from_catalogue:'現在の CampMate カタログから更新されています。', core_categories:'主要カテゴリー', max_store_options:'最大店舗数', top_current_brand:'現在の主要ブランド', what_changed:'変更点',
      product:'商品', products_nav:'商品', review_to_compare:'レビューから比較へ', shop_links_compare:'ストアリンクと価格比較',
      shop_links_note:'CampMate はストア検索リンクとライブのマーケットプレイス結果を表示し、購入前の比較を助けます。',
      why_page_exists:'このページの目的', why_page_exists_p:'CampMate の商品ページはシンプルな購入チェックポイントです。基本情報を見て、ストアを比較し、信頼できる販売先へ進めます。',
      current_ebay:'現在の eBay 掲載', loading_ebay:'eBay の結果を読み込み中…', loading_ebay_p:'初回読み込みには数秒かかる場合があります。',
      view_on_ebay:'eBay で見る', affiliate_note:'アフィリエイト注記', affiliate_note_p:'CampMate の外部リンクの一部はアフィリエイトリンクの可能性がありますが、価格は変わりません。',
      read_disclosure:'開示を読む', about:'概要', about_campmate:'CampMate について', contact:'お問い合わせ', affiliate_disclosure:'アフィリエイト開示',
      about_footer:'CampMate は、オーストラリアのキャンパーが役立つギアを見つけ、現在の掲載情報を比較し、信頼できるストアへ進めるよう支援します。',
      disclosure_footer:'開示: CampMate はアフィリエイトリンクから追加費用なしで手数料を得る場合があります。',
      no_store_links:'ストアリンクはまだありません', add_retailer_links:'products.json に販売先検索リンクを追加してください。', search_store:'店舗を検索',
      result_for:'「{query}」の検索結果 {count}件', continue_to:'{category}へ進む', category_snapshot:'カテゴリースナップショット', top_brands:'人気ブランド'
    },
    zh: {
      home:'首页', categories:'分类', popular:'热门', guides:'指南', search:'搜索',
      browse:'查看', open:'打开', products:'个', reviews:'评论', stores:'店铺',
      compare_prices:'比较页面', compare_stores:'店铺比较', category_page:'分类页面',
      all_categories:'全部分类', popular_products:'热门商品', seo_guides:'SEO 指南',
      cloudflare_ready:'Cloudflare Pages 已就绪', local_images:'包含本地图像', ebay_live:'eBay 实时联动 (/api/ebay-search)',
      filter_products:'在此分类中筛选商品', featured:'推荐排序', lowest_price:'价格从低到高', highest_price:'价格从高到低', highest_rating:'评分最高',
      no_active_filters:'没有已启用的筛选', clear_all:'清除全部', loading:'加载中…',
      browse_all_categories:'查看全部分类', category_not_found:'未找到分类', no_category_found:'未找到分类。', failed_to_load:'加载失败',
      could_not_load_products:'无法加载商品。请在 Web 服务器上运行，而不是直接打开文件。',
      no_products_match:'没有符合筛选条件的商品。', no_matching_products:'没有匹配的商品。',
      search_results:'搜索结果', type_product:'请输入商品名、品牌或分类。',
      popular_heading:'热门商品', popular_copy:'适合商品发现和联盟点击的高评分比较页面。',
      categories_heading:'全部分类', categories_copy:'先从分类页面开始，再打开商品页面查看比较和商店链接。',
      compare_site_footer:'AllIn 澳大利亚露营装备比较网站。先比较分类，再进入商品页面查看商店链接。',
      review_first:'先看评测，再做比较',
      home_h1:'更轻松地挑选并比较澳大利亚露营装备。',
      home_p:'CampMate 的设计思路是先像一个有用的购买指南，再逐步成长为更强的比较网站。浏览分类页面、打开商品页面，并在跳转前查看当前店铺信息。',
      start_guides:'先看指南', browse_categories:'浏览分类', review_led:'评测导向内容', compare_pages:'比较页面', live_ebay:'eBay 实时价格', affiliate_ready:'联盟准备完成',
      how_it_works:'CampMate 如何使用', how_it_works_p:'先从有帮助的指南开始，准备购买时再进入比较页面。',
      step1:'步骤 1', step2:'步骤 2', step3:'步骤 3', read_guide:'阅读指南', open_product_page:'打开商品页面', click_through_stores:'进入商店',
      step1_p:'通过评测型指南先筛选适合你出行风格的帐篷、椅子、炉具、灯具和冷藏箱。',
      step2_p:'每个商品页面都会提供简要信息、商店比较链接，以及可用时的 eBay 实时价格。',
      step3_p:'找到合适商品后，打开店铺页面并直接在零售平台继续购买。',
      featured_paths:'推荐指南路径', featured_paths_p:'这些页面最适合搜索流量和首次访问者。', all_guides:'全部指南',
      read_more:'了解更多', view_disclosure:'查看披露', trust_heading:'信任与透明度', trust_p:'这些小页面能让用户、合作伙伴和搜索引擎觉得网站更完整。',
      compare_pages_intro:'对于已经知道自己要看哪个分类的访客尤其有用。', all_products:'全部商品',
      updated_from_catalogue:'已根据当前 CampMate 商品目录更新。', core_categories:'核心分类', max_store_options:'最多店铺数', top_current_brand:'当前热门品牌', what_changed:'有什么变化',
      product:'商品', products_nav:'商品', review_to_compare:'从评测到比较', shop_links_compare:'商店链接与价格比较',
      shop_links_note:'CampMate 会展示商店搜索链接和实时市场结果，方便用户在购买前进行比较。',
      why_page_exists:'为什么有这个页面', why_page_exists_p:'CampMate 的商品页面是简单的购买检查点：先看基础信息、比较商店选项，再前往可信零售商。',
      current_ebay:'当前 eBay 列表', loading_ebay:'正在加载 eBay 实时结果…', loading_ebay_p:'首次加载可能需要几秒钟。',
      view_on_ebay:'在 eBay 查看', affiliate_note:'联盟说明', affiliate_note_p:'CampMate 的部分外链可能为联盟链接，但不会改变你支付的价格。',
      read_disclosure:'阅读披露', about:'关于', about_campmate:'关于 CampMate', contact:'联系', affiliate_disclosure:'联盟披露',
      about_footer:'CampMate 帮助澳大利亚露营用户发现实用装备、比较当前列表，并跳转到可信商店。',
      disclosure_footer:'披露：CampMate 可能通过联盟链接获得佣金，且不会增加你的费用。',
      no_store_links:'暂无商店链接', add_retailer_links:'请在 products.json 中添加零售商搜索链接。', search_store:'搜索商店',
      result_for:'“{query}” 的搜索结果 {count} 个', continue_to:'前往 {category}', category_snapshot:'分类概览', top_brands:'热门品牌'
    }
  };

  const categoryNames = {
    tents: {en:'Tents', ko:'텐트', ja:'テント', zh:'帐篷'},
    chairs: {en:'Chairs', ko:'의자', ja:'チェア', zh:'椅子'},
    coolers: {en:'Coolers', ko:'쿨러', ja:'クーラー', zh:'冷藏箱'},
    stoves: {en:'Stoves', ko:'스토브', ja:'ストーブ', zh:'炉具'},
    lanterns: {en:'Lanterns', ko:'랜턴', ja:'ランタン', zh:'灯具'},
    'sleep-systems': {en:'Sleep Systems', ko:'슬립 시스템', ja:'スリープシステム', zh:'睡眠系统'}
  };
  const categoryDescriptions = {
    tents: {
      en:'Family tents, touring tents, instant-up shelters and premium fast-pitch options.',
      ko:'패밀리 텐트, 투어링 텐트, 설치가 쉬운 쉘터와 프리미엄 빠른 설치형 옵션.',
      ja:'ファミリーテント、ツーリングテント、簡単設営シェルター、プレミアム高速設営モデル。',
      zh:'家庭帐篷、旅行帐篷、快速搭建帐篷与高端快搭选项。'
    },
    chairs: {
      en:'Camp chairs from budget quad-folders to premium ultralight seating.',
      ko:'가성비 쿼드폴딩 의자부터 프리미엄 초경량 의자까지.',
      ja:'お手頃なクアッドチェアから高級ウルトラライトモデルまで。',
      zh:'从实惠四折椅到高端超轻座椅。'
    },
    coolers: {
      en:'Hard coolers and iceboxes for road trips, fishing and weekend camps.',
      ko:'로드트립, 낚시, 주말 캠핑을 위한 하드 쿨러와 아이스박스.',
      ja:'ロードトリップ、釣り、週末キャンプ向けのハードクーラーとアイスボックス。',
      zh:'适合自驾、钓鱼和周末露营的硬式冷藏箱。'
    },
    stoves: {
      en:'Portable cooking systems, BBQs and dual-burner camp stoves.',
      ko:'휴대용 조리 시스템, BBQ, 투버너 캠핑 스토브.',
      ja:'携帯調理システム、BBQ、2口キャンプストーブ。',
      zh:'便携烹饪系统、BBQ 和双炉头露营炉。'
    },
    lanterns: {
      en:'LED lanterns, fuel lanterns and ambient campsite lighting.',
      ko:'LED 랜턴, 연료 랜턴, 감성 캠프 조명.',
      ja:'LED ランタン、燃料ランタン、雰囲気重視のサイト照明。',
      zh:'LED 灯、燃料灯和营地氛围照明。'
    },
    'sleep-systems': {
      en:'Swags, airbeds and premium mattresses for better camp sleep.',
      ko:'더 나은 캠핑 수면을 위한 스웨그, 에어베드, 프리미엄 매트리스.',
      ja:'より快適な睡眠のためのスワッグ、エアベッド、高品質マットレス。',
      zh:'提升露营睡眠体验的睡袋床、气垫床和高端床垫。'
    }
  };

  function normalizeLang(input){
    const v = String(input || '').toLowerCase();
    if (['ko','kr','한국어'].includes(v)) return 'ko';
    if (['ja','jp','日本語'].includes(v)) return 'ja';
    if (['zh','cn','中文'].includes(v)) return 'zh';
    return 'en';
  }
  function getLang(){
    const urlLang = new URLSearchParams(location.search).get('lang');
    if (urlLang) return normalizeLang(urlLang);
    return normalizeLang(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG);
  }
  function setLang(lang){
    const v = normalizeLang(lang);
    localStorage.setItem(STORAGE_KEY, v);
    document.documentElement.lang = v;
    applyTranslations();
    window.dispatchEvent(new CustomEvent('campmate:langchange', {detail:{lang:v}}));
  }
  function locale(){ return LOCALES[getLang()] || LOCALES.en; }
  function t(key, vars){
    const lang = getLang();
    let str = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (vars) Object.entries(vars).forEach(([k,v]) => str = str.replace(new RegExp('\\{' + k + '\\}','g'), v));
    return str;
  }
  function categoryName(slug, fallback){
    const lang = getLang();
    return (categoryNames[slug] && categoryNames[slug][lang]) || fallback || slug;
  }
  function categoryDescription(slug, fallback){
    const lang = getLang();
    return (categoryDescriptions[slug] && categoryDescriptions[slug][lang]) || fallback || '';
  }

  function addStyles(){
    if (document.getElementById('campmate-i18n-style')) return;
    const style = document.createElement('style');
    style.id = 'campmate-i18n-style';
    style.textContent = `
      .lang-switch-wrap{display:flex;align-items:center;gap:8px;margin-left:12px}
      .lang-switch{height:42px;border-radius:14px;background:rgba(255,255,255,.06);color:#e9f5ff;border:1px solid rgba(255,255,255,.08);padding:0 12px;font-weight:700}
      @media (max-width: 980px){ .lang-switch-wrap{margin-left:8px}.lang-switch{height:38px;padding:0 10px;font-size:12px} }
    `;
    document.head.appendChild(style);
  }

  function ensureLanguageSwitch(){
    addStyles();
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let select = document.querySelector('#campmate-lang-switch, [data-lang-switch]');
    if (!select){
      const wrap = document.createElement('div');
      wrap.className = 'lang-switch-wrap';
      wrap.innerHTML = `<select id="campmate-lang-switch" class="lang-switch" aria-label="Language"></select>`;
      nav.appendChild(wrap);
      select = wrap.querySelector('select');
      Object.entries(SUPPORTED).forEach(([value,label]) => {
        const opt = document.createElement('option'); opt.value = value; opt.textContent = label; select.appendChild(opt);
      });
    }
    select.value = getLang();
    if (!select.dataset.bound){
      select.dataset.bound = '1';
      select.addEventListener('change', e => setLang(e.target.value));
    }
  }

  function setText(sel, value){ const el = document.querySelector(sel); if (el && value != null) el.textContent = value; }
  function setHTML(sel, value){ const el = document.querySelector(sel); if (el && value != null) el.innerHTML = value; }
  function setPlaceholder(sel, value){ const el = document.querySelector(sel); if (el && value != null) el.setAttribute('placeholder', value); }

  function translateCommonStatic(){
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('index')) a.textContent = t('home');
      else if (href.includes('categories')) a.textContent = t('categories');
      else if (href.includes('popular')) a.textContent = t('popular');
      else if (href.includes('guides')) a.textContent = t('guides');
    });
    setPlaceholder('.nav-search input[name="q"]', getLang()==='ko' ? '텐트, 쿨러, 의자 검색…' : getLang()==='ja' ? 'テント、クーラー、チェアを検索…' : getLang()==='zh' ? '搜索帐篷、冷藏箱、椅子…' : 'Search tents, coolers, chairs...');
    const searchBtn = document.querySelector('.nav-search button'); if (searchBtn) searchBtn.textContent = t('search');

    document.querySelectorAll('.footer strong').forEach(el => {
      const text = el.textContent.trim();
      if (text === 'Browse') el.textContent = t('browse');
      else if (text === 'About') el.textContent = t('about');
      else if (text === 'Deploy') el.textContent = 'Deploy';
    });

    document.querySelectorAll('.footer a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const txt = a.textContent.trim();
      if (href.includes('categories')) a.textContent = t('all_categories');
      else if (href.includes('popular')) a.textContent = t('popular_products');
      else if (href.includes('guides')) a.textContent = txt.includes('SEO') ? t('seo_guides') : t('guides');
      else if (href.includes('about')) a.textContent = t('about_campmate');
      else if (href.includes('contact')) a.textContent = t('contact');
      else if (href.includes('disclosure')) a.textContent = t('affiliate_disclosure');
    });

    document.querySelectorAll('.footer .muted').forEach(span => {
      const text = span.textContent.trim();
      if (text === 'Cloudflare Pages ready') span.textContent = t('cloudflare_ready');
      else if (text === 'Local product images included') span.textContent = t('local_images');
      else if (text === 'eBay live via /api/ebay-search') span.textContent = t('ebay_live');
      else if (text.startsWith('Disclosure: CampMate may earn commissions')) span.textContent = t('disclosure_footer');
    });

    document.querySelectorAll('.footer p').forEach(p => {
      const text = p.textContent.trim();
      if (text.startsWith('Danawa-style camping gear compare') || text.startsWith('AllIn camping gear compare')) p.textContent = t('compare_site_footer');
      else if (text.startsWith('CampMate helps Australian campers discover useful gear')) p.textContent = t('about_footer');
      else if (text.startsWith('Disclosure: CampMate may earn commissions')) p.textContent = t('disclosure_footer');
    });
  }

  function translateIndex(){
    if (!location.pathname.endsWith('index.html') && location.pathname !== '/' && !location.pathname.endsWith('/')) return;
    setText('.hero .eyebrow', t('review_first'));
    setText('.hero h1', t('home_h1'));
    const heroP = document.querySelector('.hero .hero-copy p'); if (heroP) heroP.textContent = t('home_p');
    const heroActions = document.querySelectorAll('.hero-actions a');
    if (heroActions[0]) heroActions[0].textContent = t('start_guides');
    if (heroActions[1]) heroActions[1].textContent = t('browse_categories');
    const pills = document.querySelectorAll('.pillbar .pill');
    [t('review_led'), t('compare_pages'), t('live_ebay'), t('affiliate_ready')].forEach((label,i)=>{ if(pills[i]) pills[i].textContent = label; });
    const h2s = document.querySelectorAll('.section h2');
    const ps = document.querySelectorAll('.section-head p');
    if (h2s[0]) h2s[0].textContent = t('how_it_works');
    if (ps[0]) ps[0].textContent = t('how_it_works_p');
    const badges = document.querySelectorAll('.grid-3 .badge');
    if (badges[0]) badges[0].textContent = t('step1');
    if (badges[1]) badges[1].textContent = t('step2');
    if (badges[2]) badges[2].textContent = t('step3');
    const titles = document.querySelectorAll('.grid-3 .title');
    if (titles[0]) titles[0].textContent = t('read_guide');
    if (titles[1]) titles[1].textContent = t('open_product_page');
    if (titles[2]) titles[2].textContent = t('click_through_stores');
    const cards = document.querySelectorAll('.grid-3 .card-body p');
    if (cards[0]) cards[0].textContent = t('step1_p');
    if (cards[1]) cards[1].textContent = t('step2_p');
    if (cards[2]) cards[2].textContent = t('step3_p');
    if (h2s[1]) h2s[1].textContent = t('featured_paths');
    if (ps[1]) ps[1].textContent = t('featured_paths_p');
    const allGuides = document.querySelector('.section-head .btn.secondary.small[href="guides.html"]'); if (allGuides) allGuides.textContent = t('all_guides');
    document.querySelectorAll('a.btn.small[href*="guides/"]').forEach(a => a.textContent = t('read_guide'));
    if (h2s[2]) h2s[2].textContent = t('trust_heading');
    if (ps[2]) ps[2].textContent = t('trust_p');
    const trustBtns = document.querySelectorAll('.section:nth-of-type(3) a.btn.small');
    if (trustBtns[0]) trustBtns[0].textContent = t('read_more');
    if (trustBtns[1]) trustBtns[1].textContent = t('open');
    if (trustBtns[2]) trustBtns[2].textContent = t('view_disclosure');
    if (h2s[3]) h2s[3].textContent = t('popular_products');
    if (ps[3]) ps[3].textContent = t('compare_pages_intro');
    const allProductsBtn = document.querySelector('.section-head .btn.secondary.small[href="popular.html"]'); if (allProductsBtn) allProductsBtn.textContent = t('all_products');
  }

  function translateCategoriesPage(){
    if (!location.pathname.endsWith('categories.html')) return;
    setText('.page-hero h1', t('categories_heading'));
    const p = document.querySelector('.page-hero .section-head p'); if (p) p.textContent = t('categories_copy');
  }

  function translateCategoryPage(){
    if (!location.pathname.endsWith('category.html')) return;
    const bcLinks = document.querySelectorAll('.breadcrumb a');
    if (bcLinks[0]) bcLinks[0].textContent = t('home');
    if (bcLinks[1]) bcLinks[1].textContent = t('categories');
    const badge = document.querySelector('#category-banner .badge'); if (badge) badge.textContent = t('category_page');
    setPlaceholder('#search-in-category', t('filter_products'));
    const opts = document.querySelectorAll('#sort-select option');
    if (opts[0]) opts[0].textContent = t('featured');
    if (opts[1]) opts[1].textContent = t('lowest_price');
    if (opts[2]) opts[2].textContent = t('highest_price');
    if (opts[3]) opts[3].textContent = t('highest_rating');
    const crumb = document.getElementById('crumb-name');
    const title = document.getElementById('category-title');
    const desc = document.getElementById('category-desc');
    const q = new URLSearchParams(location.search).get('category') || '';
    if (crumb && categoryNames[q]) crumb.textContent = categoryName(q, crumb.textContent);
    if (title && categoryNames[q]) title.textContent = categoryName(q, title.textContent);
    if (desc && categoryDescriptions[q]) desc.textContent = categoryDescription(q, desc.textContent);
  }

  function translatePopularPage(){
    if (!location.pathname.endsWith('popular.html')) return;
    setText('.page-hero h1', t('popular_heading'));
    const p = document.querySelector('.page-hero .section-head p'); if (p) p.textContent = t('popular_copy');
  }

  function translateSearchPage(){
    if (!location.pathname.endsWith('search.html')) return;
    setText('.page-hero h1', t('search_results'));
    const rc = document.getElementById('result-copy');
    if (rc && (rc.textContent.includes('Loading results') || rc.textContent.includes('Type a product'))) rc.textContent = t('type_product');
  }

  function translateProductPage(){
    if (!location.pathname.endsWith('product.html')) return;
    const bcLinks = document.querySelectorAll('.breadcrumb a');
    if (bcLinks[0]) bcLinks[0].textContent = t('home');
    if (bcLinks[1]) bcLinks[1].textContent = t('products_nav');
    setText('.product-box > .badge', t('review_to_compare'));
    setText('.compare-badge', t('compare_stores'));
    setText('.compare-title', t('shop_links_compare'));
    const note = document.querySelector('.compare-note'); if (note) note.textContent = t('shop_links_note');
    const whyStrong = Array.from(document.querySelectorAll('.product-box .card strong')).find(el => el.textContent.trim() === 'Why this page exists' || el.textContent.trim() === t('why_page_exists'));
    if (whyStrong) whyStrong.textContent = t('why_page_exists');
    const whyP = Array.from(document.querySelectorAll('.product-box .card p')).find(el => el.textContent.includes('CampMate uses product pages as simple buying checkpoints') || el.textContent === t('why_page_exists_p'));
    if (whyP) whyP.textContent = t('why_page_exists_p');
    const asideH2 = document.querySelector('.price-panel h2'); if (asideH2) asideH2.textContent = t('current_ebay');
    const ebayStatus = document.getElementById('ebay-status'); if (ebayStatus && ebayStatus.textContent.includes('Loading live eBay')) ebayStatus.textContent = t('loading_ebay');
    const ebayCopy = document.getElementById('ebay-copy'); if (ebayCopy && ebayCopy.textContent.includes('This may take a few seconds')) ebayCopy.textContent = t('loading_ebay_p');
    const ebayOpen = document.getElementById('ebay-open'); if (ebayOpen) ebayOpen.textContent = t('view_on_ebay');
    const asideStrongs = document.querySelectorAll('.price-panel .card strong'); if (asideStrongs[0]) asideStrongs[0].textContent = t('affiliate_note');
    const asideP = document.querySelector('.price-panel .card p'); if (asideP) asideP.textContent = t('affiliate_note_p');
    const disclosure = document.querySelector('.price-panel .card a[href="disclosure.html"]'); if (disclosure) disclosure.textContent = t('read_disclosure');
  }

  function translateExactTexts(root){
    const lang = getLang();
    if (lang === 'en') return;
    const exact = {
      'No active filters': t('no_active_filters'),
      'Clear all': t('clear_all'),
      'Category not found': t('category_not_found'),
      'Failed to load': t('failed_to_load'),
      'No products match this filter.': t('no_products_match'),
      'No matching products found.': t('no_matching_products'),
      'No store links yet': t('no_store_links'),
      'Add retailer search links in products.json.': t('add_retailer_links'),
      'Search store': t('search_store'),
      'Open': t('open'),
      'Browse': t('browse'),
      'Search': t('search'),
      'Guides': t('guides'),
      'Popular': t('popular'),
      'Categories': t('categories'),
      'Home': t('home'),
      'All categories': t('all_categories'),
      'Popular products': t('popular_products'),
      'SEO guides': t('seo_guides'),
      'Review to compare page': t('review_to_compare'),
      'Compare stores': t('compare_stores'),
      'Shop links and price compare': t('shop_links_compare'),
      'Current eBay listings': t('current_ebay'),
      'Affiliate note': t('affiliate_note'),
      'Read disclosure': t('read_disclosure')
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const txt = node.textContent.trim();
      if (!txt) return;
      if (exact[txt]) { node.textContent = node.textContent.replace(txt, exact[txt]); return; }
      let m = txt.match(/^(\d+) reviews$/); if (m) { node.textContent = node.textContent.replace(txt, `${m[1]} ${t('reviews')}`); return; }
      m = txt.match(/^(\d+) stores$/); if (m) { node.textContent = node.textContent.replace(txt, `${m[1]} ${t('stores')}`); return; }
      m = txt.match(/^(\d+) products$/); if (m) { node.textContent = node.textContent.replace(txt, `${m[1]} ${t('products')}`); return; }
      m = txt.match(/^(\d+) result\(s\) for “(.+)”$/); if (m) { node.textContent = node.textContent.replace(txt, t('result_for', {count:m[1], query:m[2]})); return; }
      if (txt === 'Type a product, brand or category.') node.textContent = t('type_product');
      if (txt === 'Loading results…') node.textContent = t('loading');
      if (txt === 'Loading…') node.textContent = t('loading');
    });
  }

  function updatePageTitle(){
    const lang = getLang();
    if (lang === 'en') return;
    const title = document.title;
    if (title.startsWith('Categories')) document.title = `${t('categories')} | CampMate Australia`;
    else if (title.startsWith('Category')) document.title = `${t('categories')} | CampMate Australia`;
    else if (title.startsWith('Popular')) document.title = `${t('popular_products')} | CampMate Australia`;
    else if (title.startsWith('Search')) document.title = `${t('search_results')} | CampMate Australia`;
    else if (title.startsWith('Product')) document.title = `${t('product')} | CampMate Australia`;
  }

  let applying = false, raf = 0;
  function applyTranslations(){
    if (applying) return;
    applying = true;
    document.documentElement.lang = getLang();
    ensureLanguageSwitch();
    translateCommonStatic();
    translateIndex();
    translateCategoriesPage();
    translateCategoryPage();
    translatePopularPage();
    translateSearchPage();
    translateProductPage();
    translateExactTexts(document.body);
    updatePageTitle();
    applying = false;
  }
  function scheduleApply(){ if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(applyTranslations); }

  window.CampMateI18n = { getLang, setLang, t, locale, categoryName, categoryDescription, applyTranslations };
  document.addEventListener('DOMContentLoaded', () => {
    ensureLanguageSwitch();
    applyTranslations();
    const mo = new MutationObserver(() => scheduleApply());
    mo.observe(document.body, {childList:true, subtree:true, characterData:true});
  });
})();
