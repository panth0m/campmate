function i18nT(key, vars){ return window.CampMateI18n ? window.CampMateI18n.t(key, vars) : key; }
function i18nLang(){ return window.CampMateI18n ? window.CampMateI18n.getLang() : 'en'; }
function i18nCategoryName(slug, fallback){ return window.CampMateI18n ? window.CampMateI18n.categoryName(slug, fallback) : fallback; }
function i18nCategoryDescription(slug, fallback){ return window.CampMateI18n ? window.CampMateI18n.categoryDescription(slug, fallback) : fallback; }

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
function currency(n){
  const locale = window.CampMateI18n ? window.CampMateI18n.locale() : 'en-AU';
  return new Intl.NumberFormat(locale,{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n);
}
function stars(r){ return `⭐ ${r.toFixed(1)}`; }
function slugParam(){ return new URLSearchParams(location.search).get('slug'); }
function categoryParam(){ return new URLSearchParams(location.search).get('category'); }
function bySlug(list, slug){ return list.find(x => x.slug === slug); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fallbackForCategory(category){
  return `assets/images/categories/${category}.svg`;
}
function normalizeImage(product){
  if (product && product.ebayImage) return product.ebayImage;
  if (product && product.image) return product.image;
  return fallbackForCategory(product?.category || 'tents');
}
function attachImgFallback(img, category){
  img.addEventListener('error', () => {
    img.src = fallbackForCategory(category || 'tents');
  }, { once: true });
}
function enhanceImages(root=document){
  root.querySelectorAll('img[data-category]').forEach(img => attachImgFallback(img, img.dataset.category));
}

// 이미지 캐시 (slug → url)
const _imgCache = {};

// eBay 이미지 가져오기, 실패하면 Google로 fallback
async function _fetchProductImage(product) {
  // 1차: eBay
  try {
    const res = await fetch(`/api/ebay-search?q=${encodeURIComponent(product.name)}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const img = data.products?.[0]?.image || data.items?.[0]?.image;
      if (img) return img;
    }
  } catch(e) {}

  // 2차: Google 이미지 검색
  try {
    const q = encodeURIComponent(product.name + ' ' + product.brand);
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
  for (const product of products) {
    if (_imgCache[product.slug]) {
      _applyImage(product.slug, _imgCache[product.slug]);
      continue;
    }
    const url = await _fetchProductImage(product);
    if (url) {
      _imgCache[product.slug] = url;
      _applyImage(product.slug, url);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

function productCard(product){
  return `
  <article class="card">
    <a class="thumb" href="product.html?slug=${product.slug}">
      <img src="${normalizeImage(product)}" alt="${escapeHtml(product.name)}" loading="lazy" data-category="${product.category}" data-slug="${product.slug}">
    </a>
    <div class="card-body">
      <div class="kicker">${product.brand} · ${escapeHtml(i18nCategoryName(product.category, product.category.replace('-', ' ')))}</div>
      <a href="product.html?slug=${product.slug}" class="title">${escapeHtml(product.name)}</a>
      <p>${escapeHtml(product.summary)}</p>
      <div class="price-row">
        <span class="sale">${currency(product.salePrice)}</span>
        <span class="old">${currency(product.price)}</span>
      </div>
      <div class="meta">
        <span>${stars(product.rating)}</span>
        <span>${product.reviews} ${i18nT('reviews')}</span>
      </div>
      <div class="actions">
        <a class="btn small" href="product.html?slug=${product.slug}">${i18nT('compare_prices')}</a>
        <a class="btn small secondary" target="_blank" rel="noopener" href="${product.stores[0].url}">eBay AU</a>
      </div>
    </div>
  </article>`;
}
function categoryCard(cat, count){
  return `
  <article class="card cat-card">
    <div class="thumb"><img src="${cat.hero}" alt="${escapeHtml(cat.name)}" data-category="${cat.slug}"></div>
    <div class="card-body">
      <div class="badge">${count} ${i18nT('products')}</div>
      <div class="title" style="font-size:1.4rem">${escapeHtml(i18nCategoryName(cat.slug, cat.name))}</div>
      <p>${escapeHtml(i18nCategoryDescription(cat.slug, cat.description))}</p>
      <a class="btn small" href="category.html?category=${cat.slug}">${i18nT('browse')} ${escapeHtml(i18nCategoryName(cat.slug, cat.name))}</a>
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
