
const ASSET_VERSION = "20260314r3";

async function getJson(path) {
  const hasQuery = String(path).includes('?');
  const url = hasQuery ? path : `${path}?v=${ASSET_VERSION}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
function currency(n){
  const value = Number(n || 0);
  return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(value);
}
function stars(r){ return `⭐ ${Number(r||0).toFixed(1)}`; }
function slugParam(){ return new URLSearchParams(location.search).get('slug'); }
function categoryParam(){ return new URLSearchParams(location.search).get('category'); }
function bySlug(list, slug){ return (list||[]).find(x => String(x.slug||'') === String(slug||'')); }
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttribute(value){ return escapeHtml(value ?? ''); }
function slugify(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .replace(/-{2,}/g,'-');
}
function unique(list){ return [...new Set((list||[]).filter(Boolean))]; }
function getCategories(){ return Array.isArray(window.CAMPMATE_CATEGORIES) ? window.CAMPMATE_CATEGORIES : []; }
function getProducts(){ return Array.isArray(window.CAMPMATE_PRODUCTS) ? window.CAMPMATE_PRODUCTS : []; }
function getCategory(slug){
  const target = slugify(slug);
  return getCategories().find(c => slugify(c.slug || c.name) === target) || null;
}
function getProductsByCategory(slug){
  const target = slugify(slug);
  return getProducts().filter(p => slugify(p.category) === target);
}
function fallbackForCategory(category){
  return `assets/images/categories/${category || 'tents'}.svg`;
}
function normalizeImage(product){
  if (product && product.ebayImage) return product.ebayImage;
  if (product && product.image) return product.image;
  return fallbackForCategory(product?.category || 'tents');
}
function attachImgFallback(img, category){
  if (!img) return;
  img.addEventListener('error', () => {
    img.src = fallbackForCategory(category || 'tents');
  }, { once: true });
}
function enhanceImages(root=document){
  root.querySelectorAll('img[data-category]').forEach(img => attachImgFallback(img, img.dataset.category));
}
function categoryLink(cat){
  return `category.html?category=${encodeURIComponent(cat.slug || cat)}`;
}
function productLink(product){
  return `product.html?slug=${encodeURIComponent(product.slug)}`;
}
function displayName(product){
  const brand = String(product?.brand || '').trim();
  const name = String(product?.name || '').trim();
  if (!brand || !name) return name || brand || 'Product';
  const lowerBrand = brand.toLowerCase();
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith(lowerBrand + ' ')) return name;
  if (lowerName === lowerBrand) return name;
  return `${brand} ${name}`;
}
function guessType(product){
  const text = `${product?.name || ''} ${product?.summary || ''} ${(product?.highlights || []).join(' ')}`.toLowerCase();
  if (/air tent|inflatable/.test(text)) return 'Air tent';
  if (/swag/.test(text)) return 'Swag';
  if (/instant|fast frame|quick/.test(text)) return 'Instant / fast setup';
  if (/canvas/.test(text)) return 'Canvas';
  if (/backpack/.test(text)) return 'Backpacking';
  if (/chair/.test(text)) return 'Camping chair';
  if (/cooler|ice/.test(text)) return 'Cooler';
  if (/stove|burner|bbq/.test(text)) return 'Camp stove';
  if (/lantern|light/.test(text)) return 'Lantern';
  if (/mat|sleeping bag|sleep/.test(text)) return 'Sleep system';
  return 'General camping';
}
function buildAffiliateUrl(name, url, productName) {
  let finalUrl = String(url || '#').trim();
  if (!finalUrl || finalUrl === '#') return '#';

  const lowerName = String(name || '').toLowerCase();
  const isAmazon = lowerName.includes('amazon');
  const amazonTag = 'campmateau20-22';

  if (isAmazon) {
    try {
      const parsed = new URL(finalUrl, window.location.origin);
      if (!parsed.searchParams.get('tag')) parsed.searchParams.set('tag', amazonTag);
      finalUrl = parsed.toString();
    } catch {
      const encodedName = encodeURIComponent(productName || 'camping gear');
      finalUrl = `https://www.amazon.com.au/s?k=${encodedName}&tag=${amazonTag}`;
    }
  }
  return finalUrl;
}

const _imgCache = {};
async function _fetchProductImage(product) {
  try {
    const res = await fetch(`/api/ebay-search?q=${encodeURIComponent(product.name)}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const img = data.products?.[0]?.image || data.items?.[0]?.image;
      if (img) return img;
    }
  } catch(e) {}
  try {
    const q = encodeURIComponent(product.name + ' ' + (product.brand || ''));
    const res = await fetch(`/api/google-search?q=${q}&num=1`);
    if (res.ok) {
      const data = await res.json();
      const img = data.items?.[0]?.image;
      if (img) return img;
    }
  } catch(e) {}
  return null;
}
function _applyImage(slug, imageUrl) {
  document.querySelectorAll(`img[data-slug="${slug}"]`).forEach(img => {
    img.src = imageUrl;
    img.style.objectFit = 'contain';
    img.style.background = '#fff';
    img.style.padding = '8px';
  });
}
async function loadEbayImagesForCards(products) {
  for (const product of products || []) {
    if (_imgCache[product.slug]) {
      _applyImage(product.slug, _imgCache[product.slug]);
      continue;
    }
    const url = await _fetchProductImage(product);
    if (url) {
      _imgCache[product.slug] = url;
      _applyImage(product.slug, url);
    }
    await new Promise(r => setTimeout(r, 160));
  }
}
function productCard(product){
  return `
  <article class="card">
    <a class="thumb" href="${productLink(product)}">
      <img src="${normalizeImage(product)}" alt="${escapeHtml(product.name)}" loading="lazy" data-category="${product.category}" data-slug="${product.slug}">
    </a>
    <div class="card-body">
      <div class="kicker">${escapeHtml(product.brand)} · ${escapeHtml((product.categoryName || product.category || '').replace('-', ' '))}</div>
      <a href="${productLink(product)}" class="title">${escapeHtml(displayName(product))}</a>
      <p>${escapeHtml(product.summary || '')}</p>
      <div class="price-row">
        <span class="sale">${currency(product.salePrice)}</span>
        <span class="old">${currency(product.price)}</span>
      </div>
      <div class="meta">
        <span>${stars(product.rating)}</span>
        <span>${product.reviews || 0} reviews</span>
      </div>
      <div class="actions">
        <a class="btn small" href="${productLink(product)}">Compare prices</a>
        <a class="btn small secondary" target="_blank" rel="noopener sponsored" href="${buildAffiliateUrl(product.stores?.[0]?.name, product.stores?.[0]?.url, product.name)}">${escapeHtml(product.stores?.[0]?.name || 'Store')}</a>
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
      <a class="btn small" href="${categoryLink(cat)}">Browse ${escapeHtml(cat.name)}</a>
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
