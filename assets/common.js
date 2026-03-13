
const AMAZON_TAG = 'campmateau-22';
function getCategories(){ return window.CAMPMATE_CATEGORIES || []; }
function getProducts(){ return window.CAMPMATE_PRODUCTS || []; }
function getJson(path){
  if (String(path).includes('categories.json')) return Promise.resolve(getCategories());
  if (String(path).includes('products.json')) return Promise.resolve(getProducts());
  return fetch(path).then(r => { if(!r.ok) throw new Error('Failed to fetch ' + path); return r.json(); });
}
function setupSearchForm(){
  document.querySelectorAll('[data-search-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = (new FormData(form).get('q') || '').toString().trim();
      location.href = 'search.html?q=' + encodeURIComponent(q);
    });
  });
}
function currency(n){ return typeof n === 'number' ? new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n) : ''; }
function stars(v){ const rating = Number(v||0).toFixed(1); return '★ ' + rating; }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttribute(s){ return escapeHtml(s).replace(/'/g,'&#39;'); }
function slugify(v){ return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function categoryParam(){ return new URLSearchParams(location.search).get('category') || ''; }
function productLink(product){ return 'product.html?slug=' + encodeURIComponent(product.slug); }
function categoryLink(category){ return category.page || ('category.html?category=' + encodeURIComponent(category.slug)); }
function placeholderSvg(title, category){
  const label = encodeURIComponent((category || 'CampMate').replace(/-/g,' ') + ' · ' + title);
  return `data:image/svg+xml;charset=UTF-8,` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f3d70"/><stop offset="1" stop-color="#081a33"/></linearGradient></defs><rect width="1200" height="900" fill="url(%23g)"/><circle cx="920" cy="170" r="140" fill="#63e2ff" opacity=".12"/><circle cx="230" cy="720" r="180" fill="#7cf2db" opacity=".10"/><rect x="95" y="110" rx="42" ry="42" width="1010" height="680" fill="none" stroke="rgba(255,255,255,.18)"/><text x="120" y="405" fill="#63e2ff" font-size="44" font-family="Arial, sans-serif" font-weight="700">CampMate Australia</text><text x="120" y="470" fill="#e8f1ff" font-size="64" font-family="Arial, sans-serif" font-weight="800">${label}</text></svg>`;
}
function normalizeImage(product){ return product.image || placeholderSvg(product.name || 'Camping gear', product.category || 'camping'); }
function attachImgFallback(img, category){ img.onerror = () => { img.src = placeholderSvg(img.alt || 'Camping gear', category || img.dataset.category || 'camping'); }; }
function enhanceImages(scope=document){ scope.querySelectorAll('img').forEach(img => attachImgFallback(img, img.dataset.category)); }
function productCard(product){
  return `<article class="card"><a class="thumb" href="${productLink(product)}"><img src="${escapeAttribute(normalizeImage(product))}" alt="${escapeAttribute(product.name)}" data-category="${escapeAttribute(product.category)}"></a><div class="card-body"><div class="badge">${escapeHtml(product.categoryName || product.category)}</div><a class="title" href="${productLink(product)}">${escapeHtml(product.brand)} ${escapeHtml(product.name)}</a><div class="price-row"><span class="sale">${currency(product.salePrice)}</span><span class="old">${currency(product.price)}</span></div><div class="meta"><span>${stars(product.rating)}</span><span>${escapeHtml(String(product.reviews || 0))} reviews</span></div><p>${escapeHtml(product.summary || '')}</p><a class="btn small" href="${productLink(product)}">Open compare page</a></div></article>`;
}
function categoryCard(category, count){
  return `<article class="card"><div class="card-body"><div class="badge">${escapeHtml(String(count))} products</div><a class="title" href="${categoryLink(category)}">${escapeHtml(category.name)}</a><p>${escapeHtml(category.description || '')}</p><a class="btn small" href="${categoryLink(category)}">Browse ${escapeHtml(category.short || category.name)}</a></div></article>`;
}
function buildAffiliateUrl(name, url, productName) {
  let finalUrl = String(url || '#').trim();
  if (!finalUrl || finalUrl === '#') return '#';
  const lowerName = String(name || '').toLowerCase();
  const isAmazon = lowerName.includes('amazon');
  if (isAmazon) {
    try {
      const parsed = new URL(finalUrl, location.origin);
      if (!parsed.searchParams.get('tag')) parsed.searchParams.set('tag', AMAZON_TAG);
      finalUrl = parsed.toString();
    } catch {
      finalUrl = `https://www.amazon.com.au/s?k=${encodeURIComponent(productName || 'camping gear')}&tag=${AMAZON_TAG}`;
    }
  }
  return finalUrl;
}
async function loadEbayImagesForCards(products){
  if (!Array.isArray(products)) return;
  // Soft enhancement only. Page works without network access.
  const cards = [...document.querySelectorAll('.card img')];
  products.slice(0,4).forEach((p,idx) => { if (cards[idx]) cards[idx].src = normalizeImage(p); });
}
function renderCategoryLanding(slug, options={}){
  const category = getCategories().find(c => c.slug === slug);
  const products = getProducts().filter(p => p.category === slug);
  if (!category) return;
  document.title = options.title || category.seo_title;
  const titleEl = document.getElementById('category-title'); if (titleEl) titleEl.textContent = category.name;
  const descEl = document.getElementById('category-desc'); if (descEl) descEl.textContent = category.description;
  const crumbEl = document.getElementById('crumb-name'); if (crumbEl) crumbEl.textContent = category.short || category.name;
  const grid = document.getElementById('category-products'); if (grid) { grid.innerHTML = products.map(productCard).join(''); enhanceImages(grid); }
  const countEl = document.getElementById('category-count'); if (countEl) countEl.textContent = String(products.length);
  const picksEl = document.getElementById('top-picks'); if (picksEl) picksEl.innerHTML = products.slice(0,4).map(p => `<div class="rowish"><div><strong>${escapeHtml(p.brand)} ${escapeHtml(p.name)}</strong><div class="muted">${escapeHtml(p.summary)}</div></div><div>${currency(p.salePrice)}</div></div>`).join('');
  const faqEl = document.getElementById('faq-grid'); if (faqEl && Array.isArray(category.faq)) faqEl.innerHTML = category.faq.map(([q,a]) => `<article class="faq-item"><h3>${escapeHtml(q)}</h3><p class="muted">${escapeHtml(a)}</p></article>`).join('');
}


function deriveTags(product){
  const text = `${product.name||''} ${product.summary||''} ${(product.highlights||[]).join(' ')}`.toLowerCase();
  const tags = [];
  const add = (cond, label) => { if (cond && !tags.includes(label)) tags.push(label); };
  if (product.category === 'tents') {
    add(/instant|fast frame|quick/.test(text), 'Instant');
    add(/family|6p|8p|10 person|10p/.test(text), 'Family');
    add(/swag/.test(text), 'Swag');
    add(/touring/.test(text), 'Touring');
    add(/lightweight/.test(text), 'Lightweight');
  } else if (product.category === 'chairs') {
    add(/padded/.test(text), 'Padded');
    add(/recliner|lounger/.test(text), 'Recliner');
    add(/lightweight|compact/.test(text), 'Lightweight');
    add(/beach|low/.test(text), 'Beach');
    add(/director/.test(text), 'Director');
  } else if (product.category === 'coolers') {
    add(/wheel|wheeled/.test(text), 'Wheeled');
    add(/rotomold|rotomould/.test(text), 'Premium Ice');
    add(/compact|small/.test(text), 'Compact');
    add(/soft/.test(text), 'Soft Cooler');
    add(/hard|ice box/.test(text), 'Hard Cooler');
  } else if (product.category === 'stoves') {
    add(/dual|2-burner|two-burner/.test(text), '2 Burner');
    add(/single/.test(text), 'Single Burner');
    add(/compact|portable/.test(text), 'Compact');
    add(/backpacking|ultralight/.test(text), 'Backpacking');
  } else if (product.category === 'lanterns') {
    add(/rechargeable|usb/.test(text), 'Rechargeable');
    add(/led/.test(text), 'LED');
    add(/compact|portable/.test(text), 'Compact');
    add(/string/.test(text), 'String Light');
  } else if (product.category === 'sleep-systems') {
    add(/sleeping bag|bag/.test(text), 'Sleeping Bag');
    add(/mat|pad/.test(text), 'Mat');
    add(/insulated|warm/.test(text), 'Insulated');
    add(/lightweight|packable/.test(text), 'Lightweight');
    add(/comfort|thick/.test(text), 'Comfort');
  }
  return tags;
}
function priceBand(product){
  const p = Number(product.salePrice || product.price || 0);
  if (p < 100) return 'Under $100';
  if (p < 250) return '$100–$249';
  if (p < 500) return '$250–$499';
  return '$500+';
}
function productImage(product){ return escapeAttribute(normalizeImage(product)); }
function comparisonStoreRows(product){
  const stores = (product.stores || []).map(store => {
    const label = store.name || 'Store';
    const storePrice = store.price ? currency(store.price) : 'Search current price';
    const shipping = store.shipping || 'See retailer';
    const href = buildAffiliateUrl(label, store.url, `${product.brand} ${product.name}`);
    return `<div class="mini-compare"><div class="store-name">${escapeHtml(label)}</div><div class="price-tag">${escapeHtml(storePrice)}</div><div class="muted">${escapeHtml(shipping)}</div><a class="btn secondary small" target="_blank" rel="noopener sponsored" href="${escapeAttribute(href)}">Open</a></div>`;
  });
  return `<div class="store-table"><div class="mini-compare header"><div>Store</div><div>Price</div><div>Shipping</div><div></div></div>${stores.join('')}</div>`;
}
function setupHomeStats(){
  const holder = document.getElementById('home-stats');
  if (!holder) return;
  const products = getProducts();
  const categories = getCategories();
  const guides = window.CAMPMATE_GUIDES || [];
  const brands = [...new Set(products.map(p => p.brand))];
  holder.innerHTML = [
    ['Products', String(products.length)],
    ['Categories', String(categories.length)],
    ['Guides', String(guides.length || 6)],
    ['Brands', String(brands.length)]
  ].map(([label,value]) => `<div class="stat"><strong>${escapeHtml(value)}</strong><span class="muted">${escapeHtml(label)}</span></div>`).join('');
}
function createCategoryFilters(products){
  const brands = [...new Set(products.map(p => p.brand))].sort();
  const tags = [...new Set(products.flatMap(deriveTags))].sort();
  return { brands, tags, priceBands: ['Under $100','$100–$249','$250–$499','$500+'], ratings: ['4.5+','4.0+'] };
}
function renderDanawaCategory(slug){
  const category = getCategories().find(c => c.slug === slug);
  const products = getProducts().filter(p => p.category === slug);
  if (!category) return;
  renderCategoryLanding(slug);
  const mount = document.getElementById('category-explorer');
  if (!mount) return;
  const filters = createCategoryFilters(products);
  mount.innerHTML = `
    <div class="danawa-layout">
      <aside class="filter-sidebar">
        <div class="badge">Filter products</div>
        <div class="filter-group"><h3>Search</h3><input id="cat-search" class="input" placeholder="Search ${escapeAttribute(category.short || category.name)}"></div>
        <div class="filter-group"><h3>Brand</h3><div class="check-list">${filters.brands.map(b => `<label class="check-item"><input type="checkbox" name="brand" value="${escapeAttribute(b)}"> <span>${escapeHtml(b)}</span></label>`).join('')}</div></div>
        <div class="filter-group"><h3>Type</h3><div class="check-list">${filters.tags.map(t => `<label class="check-item"><input type="checkbox" name="tag" value="${escapeAttribute(t)}"> <span>${escapeHtml(t)}</span></label>`).join('')}</div></div>
        <div class="filter-group"><h3>Price</h3><div class="check-list">${filters.priceBands.map(t => `<label class="check-item"><input type="checkbox" name="price" value="${escapeAttribute(t)}"> <span>${escapeHtml(t)}</span></label>`).join('')}</div></div>
        <div class="filter-group"><h3>Rating</h3><div class="check-list">${filters.ratings.map(t => `<label class="check-item"><input type="checkbox" name="rating" value="${escapeAttribute(t)}"> <span>${escapeHtml(t)}</span></label>`).join('')}</div></div>
        <div class="filter-actions"><button id="reset-filters" class="btn secondary small" type="button">Reset</button></div>
      </aside>
      <section class="results-panel">
        <div class="results-toolbar">
          <div><div class="badge">Compare list</div><div id="results-summary" class="results-summary"></div></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap"><select id="cat-sort" class="select" style="min-width:220px"><option value="featured">Featured</option><option value="price-low">Lowest price</option><option value="price-high">Highest price</option><option value="rating">Highest rating</option><option value="reviews">Most reviews</option></select></div>
        </div>
        <div id="active-filters" class="filter-chip-row"></div>
        <div id="category-results" class="category-grid"></div>
      </section>
    </div>`;
  const searchInput = mount.querySelector('#cat-search');
  const sortSelect = mount.querySelector('#cat-sort');
  const summary = mount.querySelector('#results-summary');
  const results = mount.querySelector('#category-results');
  const chipRow = mount.querySelector('#active-filters');
  const readFilters = () => ({
    q: searchInput.value.trim().toLowerCase(),
    brands: [...mount.querySelectorAll('input[name="brand"]:checked')].map(x=>x.value),
    tags: [...mount.querySelectorAll('input[name="tag"]:checked')].map(x=>x.value),
    prices: [...mount.querySelectorAll('input[name="price"]:checked')].map(x=>x.value),
    ratings: [...mount.querySelectorAll('input[name="rating"]:checked')].map(x=>x.value),
    sort: sortSelect.value
  });
  const apply = () => {
    const state = readFilters();
    let current = products.filter(p => {
      const hay = `${p.brand} ${p.name} ${p.summary} ${(p.highlights||[]).join(' ')}`.toLowerCase();
      if (state.q && !hay.includes(state.q)) return false;
      if (state.brands.length && !state.brands.includes(p.brand)) return false;
      const tags = deriveTags(p);
      if (state.tags.length && !state.tags.some(t => tags.includes(t))) return false;
      if (state.prices.length && !state.prices.includes(priceBand(p))) return false;
      if (state.ratings.length) {
        const rating = Number(p.rating || 0);
        if (!state.ratings.some(r => r === '4.5+' ? rating >= 4.5 : rating >= 4.0)) return false;
      }
      return true;
    });
    if (state.sort === 'price-low') current.sort((a,b)=>(a.salePrice||a.price)-(b.salePrice||b.price));
    else if (state.sort === 'price-high') current.sort((a,b)=>(b.salePrice||b.price)-(a.salePrice||a.price));
    else if (state.sort === 'rating') current.sort((a,b)=>(b.rating||0)-(a.rating||0) || (b.reviews||0)-(a.reviews||0));
    else if (state.sort === 'reviews') current.sort((a,b)=>(b.reviews||0)-(a.reviews||0));
    else current.sort((a,b)=>(b.rating||0)-(a.rating||0) || (a.salePrice||a.price)-(b.salePrice||b.price));
    summary.textContent = `${current.length} products in ${category.name}`;
    const chips=[];
    state.brands.forEach(v=>chips.push(['brand',v]));
    state.tags.forEach(v=>chips.push(['tag',v]));
    state.prices.forEach(v=>chips.push(['price',v]));
    state.ratings.forEach(v=>chips.push(['rating',v]));
    if (state.q) chips.push(['search',state.q]);
    chipRow.innerHTML = chips.map(([k,v]) => `<span class="filter-chip">${escapeHtml(v)} <button type="button" data-k="${escapeAttribute(k)}" data-v="${escapeAttribute(v)}">×</button></span>`).join('');
    results.innerHTML = current.length ? current.map(product => `<article class="card"><a class="thumb" href="${productLink(product)}"><img src="${productImage(product)}" alt="${escapeAttribute(product.name)}" data-category="${escapeAttribute(product.category)}"></a><div class="card-body"><div class="badge">${escapeHtml(product.brand)}</div><a class="title" href="${productLink(product)}">${escapeHtml(product.name)}</a><div class="price-row"><span class="sale">${currency(product.salePrice)}</span><span class="old">${currency(product.price)}</span></div><div class="meta"><span>${stars(product.rating)}</span><span>${escapeHtml(String(product.reviews||0))} reviews</span><span>${escapeHtml(priceBand(product))}</span></div><p>${escapeHtml(product.summary || '')}</p><div class="pillbar" style="margin:12px 0">${deriveTags(product).slice(0,3).map(t=>`<span class="pill">${escapeHtml(t)}</span>`).join('')}</div><a class="btn small" href="${productLink(product)}">Compare prices</a></div></article>`).join('') : '<div class="empty">No products match these filters yet.</div>';
    enhanceImages(results);
  };
  mount.addEventListener('change', e => { if (e.target.matches('input,select')) apply(); });
  mount.addEventListener('input', e => { if (e.target === searchInput) apply(); });
  mount.addEventListener('click', e => {
    const btn = e.target.closest('#reset-filters');
    if (btn) {
      mount.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
      searchInput.value = ''; sortSelect.value = 'featured'; apply(); return;
    }
    const chipBtn = e.target.closest('.filter-chip button');
    if (chipBtn) {
      const {k,v} = chipBtn.dataset;
      if (k === 'search') searchInput.value = '';
      else mount.querySelectorAll(`input[name="${k}"]`).forEach(i => { if (i.value === v) i.checked = false; });
      apply();
    }
  });
  apply();
}
function renderProductEnhanced(){
  const holder = document.getElementById('product-enhanced');
  if (!holder) return;
  const slug = new URLSearchParams(location.search).get('slug') || '';
  const product = getProducts().find(p => p.slug === slug);
  if (!product) return;
  holder.innerHTML = `
    <section class="compare-strip"><div class="badge">Quick spec view</div><div class="kv-grid"><div class="kv-card"><strong>Brand</strong>${escapeHtml(product.brand)}</div><div class="kv-card"><strong>Category</strong>${escapeHtml(product.categoryName || product.category)}</div><div class="kv-card"><strong>Rating</strong>${escapeHtml(String(product.rating || '—'))} / 5</div><div class="kv-card"><strong>Reviews</strong>${escapeHtml(String(product.reviews || 0))}</div></div></section>
    <section class="compare-strip"><div class="badge">Store comparison</div><h2 style="margin:12px 0 14px">Compare store links for ${escapeHtml(product.brand)} ${escapeHtml(product.name)}</h2>${comparisonStoreRows(product)}</section>`;
}
