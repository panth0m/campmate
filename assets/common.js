
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

function displayName(product){
  if (!product) return '';
  const brand = String(product.brand || '').trim();
  const name = String(product.name || '').trim();
  if (!brand) return name;
  if (!name) return brand;
  return name.toLowerCase().startsWith(brand.toLowerCase() + ' ') ? name : `${brand} ${name}`;
}
function imageLabel(product){
  if (!product) return 'Camping gear';
  return displayName(product) || product.name || 'Camping gear';
}

function productLink(product){ return 'product.html?slug=' + encodeURIComponent(product.slug); }
function categoryLink(category){ return category.page || ('category.html?category=' + encodeURIComponent(category.slug)); }
function placeholderSvg(title, category, brand=''){
  const safeTitle = String(title || 'Camping gear').slice(0, 60);
  const safeBrand = String(brand || '').slice(0, 28);
  const safeCategory = String(category || 'camping').replace(/-/g, ' ');
  const art = {
    'tents': '<path d="M170 610 L370 340 L560 610 Z" fill="#c8f7ed" opacity="0.92"/><path d="M360 610 L560 340 L760 610 Z" fill="#89e4d0" opacity="0.95"/><path d="M470 390 L470 610" stroke="#1f425b" stroke-width="16" stroke-linecap="round"/>',
    'chairs': '<rect x="320" y="330" width="240" height="170" rx="26" fill="#bfeee4"/><path d="M350 500 L300 620 M530 500 L580 620 M350 350 L290 270 M530 350 L590 270" stroke="#d9fbf3" stroke-width="22" stroke-linecap="round"/>',
    'coolers': '<rect x="250" y="340" width="380" height="240" rx="34" fill="#bfeee4"/><rect x="300" y="285" width="280" height="70" rx="26" fill="#8be7d2"/><rect x="410" y="240" width="60" height="58" rx="18" fill="#dffcf6"/>',
    'stoves': '<rect x="250" y="360" width="420" height="180" rx="28" fill="#bfeee4"/><circle cx="390" cy="450" r="58" fill="#67d9be"/><circle cx="530" cy="450" r="58" fill="#67d9be"/><rect x="300" y="560" width="320" height="18" rx="9" fill="#2f5468" opacity="0.75"/>',
    'lanterns': '<rect x="360" y="290" width="200" height="260" rx="36" fill="#bfeee4"/><rect x="405" y="220" width="110" height="90" rx="28" fill="#8be7d2"/><circle cx="460" cy="420" r="72" fill="#dffcf6" opacity="0.65"/>',
    'sleep-systems': '<rect x="230" y="380" width="470" height="180" rx="88" fill="#bfeee4"/><rect x="240" y="325" width="165" height="110" rx="44" fill="#8be7d2"/><rect x="310" y="470" width="310" height="22" rx="11" fill="#2f5468" opacity="0.75"/>'
  }[category] || '<rect x="250" y="320" width="420" height="260" rx="42" fill="#bfeee4"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1a5768"/><stop offset="1" stop-color="#53dbc3"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="930" cy="170" r="165" fill="#dffcf6" opacity="0.15"/><circle cx="210" cy="720" r="140" fill="#7ef3de" opacity="0.11"/><rect x="86" y="100" rx="42" ry="42" width="1028" height="700" fill="none" stroke="rgba(255,255,255,.15)"/>${art}<text x="120" y="190" fill="#effcff" font-size="34" font-family="Arial, sans-serif" font-weight="700">CampMate Australia</text><text x="120" y="620" fill="#eaf8ff" font-size="42" font-family="Arial, sans-serif">${safeBrand || 'Compare stores'}</text><text x="120" y="700" fill="#ffffff" font-size="62" font-family="Arial, sans-serif" font-weight="800">${safeTitle}</text><text x="120" y="770" fill="#d8f6ff" font-size="32" font-family="Arial, sans-serif">${safeCategory} • compare stores</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function normalizeImage(product){ return placeholderSvg(imageLabel(product), product.category || 'camping', product.brand || ''); }
function attachImgFallback(img, category){ img.onerror = () => { img.src = placeholderSvg(img.alt || 'Camping gear', category || img.dataset.category || 'camping'); }; }
function enhanceImages(scope=document){ scope.querySelectorAll('img').forEach(img => attachImgFallback(img, img.dataset.category)); }
function productCard(product){
  return `<article class="card"><a class="thumb" href="${productLink(product)}"><img src="${escapeAttribute(normalizeImage(product))}" alt="${escapeAttribute(product.name)}" data-category="${escapeAttribute(product.category)}"></a><div class="card-body"><div class="badge">${escapeHtml(product.categoryName || product.category)}</div><a class="title" href="${productLink(product)}">${escapeHtml(displayName(product))}</a><div class="price-row"><span class="sale">${currency(product.salePrice)}</span><span class="old">${currency(product.price)}</span></div><div class="meta"><span>${stars(product.rating)}</span><span>${escapeHtml(String(product.reviews || 0))} reviews</span></div><p>${escapeHtml(product.summary || '')}</p><a class="btn small" href="${productLink(product)}">Open compare page</a></div></article>`;
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
