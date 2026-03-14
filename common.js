async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
function currency(n){
  return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n);
}
function stars(r){ return `⭐ ${(Number(r)||0).toFixed(1)}`; }
function slugParam(){ return new URLSearchParams(location.search).get('slug'); }
function categoryParam(){ return new URLSearchParams(location.search).get('category'); }
function bySlug(list, slug){ return list.find(x => x.slug === slug); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fallbackForCategory(category){
  return `assets/images/categories/${category}.svg`;
}

const _imgCache = {};
let _imgCacheLoaded = false;

function loadImageCache() {
  if (_imgCacheLoaded) return;
  _imgCacheLoaded = true;
  try {
    const raw = localStorage.getItem('campmate_image_cache_v2');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') Object.assign(_imgCache, saved);
  } catch (e) {
    console.warn('Image cache load failed', e);
  }
}
function saveImageCache() {
  try {
    localStorage.setItem('campmate_image_cache_v2', JSON.stringify(_imgCache));
  } catch (e) {
    // ignore quota / private mode failures
  }
}
function getCachedImage(slug) {
  loadImageCache();
  return slug ? _imgCache[slug] || null : null;
}
function setCachedImage(slug, url) {
  if (!slug || !url) return;
  loadImageCache();
  _imgCache[slug] = url;
  saveImageCache();
}
function normalizeImage(product){
  const cached = getCachedImage(product?.slug);
  if (cached) return cached;
  if (product && product.ebayImage) return product.ebayImage;
  if (product && product.image) return product.image;
  return fallbackForCategory(product?.category || 'tents');
}
function attachImgFallback(img, category){
  img.addEventListener('error', () => {
    img.src = fallbackForCategory(category || 'tents');
    img.style.objectFit = '';
    img.style.background = '';
    img.style.padding = '';
  }, { once: true });
}
function enhanceImages(root=document){
  root.querySelectorAll('img[data-category]').forEach(img => attachImgFallback(img, img.dataset.category));
}

function _extractItemId(url) {
  const text = String(url || '');
  const match = text.match(/\/itm\/(\d{9,})/i) || text.match(/[?&]itm=(\d{9,})/i);
  return match ? match[1] : '';
}

async function _fetchProductImage(product) {
  const cached = getCachedImage(product?.slug);
  if (cached) return cached;

  const ebayStore = (Array.isArray(product?.stores) ? product.stores : []).find(s => /ebay/i.test(String(s?.name||'')));
  const itemId = _extractItemId(ebayStore?.url || '');

  if (itemId) {
    try {
      const res = await fetch(`/api/ebay-search?q=${encodeURIComponent(product.name)}&itemId=${encodeURIComponent(itemId)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        const img = data.products?.[0]?.image || data.items?.[0]?.image;
        if (img) return img;
      }
    } catch (e) {}
  }

  try {
    const query = [product?.brand, product?.name, product?.category].filter(Boolean).join(' ');
    const res = await fetch(`/api/ebay-search?q=${encodeURIComponent(query)}&limit=3`);
    if (res.ok) {
      const data = await res.json();
      const items = data.products || data.items || [];
      const wanted = `${product?.brand || ''} ${product?.name || ''}`.toLowerCase();
      const best = items.find(it => `${it?.title || ''}`.toLowerCase().includes(String(product?.brand || '').toLowerCase())) || items[0];
      const img = best?.image;
      if (img) return img;
    }
  } catch(e) {}

  return null;
}

function _applyImage(slug, imageUrl) {
  if (!slug || !imageUrl) return;
  setCachedImage(slug, imageUrl);
  document.querySelectorAll(`img[data-slug="${slug}"]`).forEach(img => {
    img.src = imageUrl;
    img.style.objectFit = 'contain';
    img.style.background = '#fff';
    img.style.padding = '8px';
  });
}

async function loadEbayImagesForCards(products) {
  loadImageCache();
  const queue = [];
  const seen = new Set();
  for (const product of products || []) {
    if (!product?.slug || seen.has(product.slug)) continue;
    seen.add(product.slug);
    const cached = getCachedImage(product.slug);
    if (cached) {
      _applyImage(product.slug, cached);
      continue;
    }
    queue.push(product);
  }
  const batchSize = 4;
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    await Promise.all(batch.map(async product => {
      const url = await _fetchProductImage(product);
      if (url) _applyImage(product.slug, url);
    }));
    await new Promise(r => setTimeout(r, 180));
  }
}

function productCard(product){
  const primaryStore = Array.isArray(product.stores) && product.stores.length ? product.stores[0] : { url:'#', name:'Store' };
  return `
  <article class="card">
    <a class="thumb" href="product.html?slug=${product.slug}">
      <img src="${normalizeImage(product)}" alt="${escapeHtml(product.name)}" loading="lazy" data-category="${product.category}" data-slug="${product.slug}">
    </a>
    <div class="card-body">
      <div class="kicker">${escapeHtml(product.brand)} · ${escapeHtml((product.category || '').replace('-', ' '))}</div>
      <a href="product.html?slug=${product.slug}" class="title">${escapeHtml(product.name)}</a>
      <p>${escapeHtml(product.summary || '')}</p>
      <div class="price-row">
        <span class="sale">${currency(product.salePrice || product.price || 0)}</span>
        <span class="old">${product.price ? currency(product.price) : ''}</span>
      </div>
      <div class="meta">
        <span>${stars(product.rating || 0)}</span>
        <span>${product.reviews || 0} reviews</span>
      </div>
      <div class="actions">
        <a class="btn small" href="product.html?slug=${product.slug}">Compare page</a>
        <a class="btn small secondary" target="_blank" rel="noopener" href="${escapeHtml(primaryStore.url || '#')}">${escapeHtml(primaryStore.name || 'Store')}</a>
      </div>
    </div>
  </article>`;
}
function categoryCard(cat, count){
  return `
  <article class="card cat-card">
    <div class="thumb"><img src="${cat.hero}" alt="${escapeHtml(cat.name)}" data-category="${cat.slug}"></div>
    <div class="card-body">
      <div class="badge">${count} products</div>
      <div class="title" style="font-size:1.4rem">${escapeHtml(cat.name)}</div>
      <p>${escapeHtml(cat.description)}</p>
      <a class="btn small" href="category.html?category=${cat.slug}">Browse ${escapeHtml(cat.name)}</a>
    </div>
  </article>`;
}
function setupSearchForm(){
  const form = document.querySelector('[data-search-form]');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    const target = form.dataset.searchTarget || 'search.html';
    location.href = `${target}?q=${encodeURIComponent(q)}`;
  });
}
