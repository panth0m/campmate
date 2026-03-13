
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
