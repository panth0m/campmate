const ASSET_VERSION = "20260316";
const CATALOG_CACHE = { categories: null, products: null, promise: null };

async function getJson(path) {
  const hasQuery = String(path).includes('?');
  const url = hasQuery ? path : `${path}?v=${ASSET_VERSION}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadCatalog(force = false) {
  if (CATALOG_CACHE.promise && !force) return CATALOG_CACHE.promise;
  CATALOG_CACHE.promise = (async () => {
    let categories = window.CAMPMATE_CATEGORIES || [];
    let products = window.CAMPMATE_PRODUCTS || [];

    if (!categories.length) categories = await getJson('data/categories.json');
    if (!products.length) {
      try {
        products = await getJson('data/products.json');
      } catch (err) {
        products = await getJson('data/products_source.json');
      }
    }

    CATALOG_CACHE.categories = Array.isArray(categories) ? categories : [];
    CATALOG_CACHE.products = Array.isArray(products) ? products.map(sanitizeProduct) : [];
    return { categories: CATALOG_CACHE.categories, products: CATALOG_CACHE.products };
  })();
  return CATALOG_CACHE.promise;
}

function getCategories() { return CATALOG_CACHE.categories || window.CAMPMATE_CATEGORIES || []; }
function getProducts() { return CATALOG_CACHE.products || window.CAMPMATE_PRODUCTS || []; }

function currency(n) {
  const value = Number.isFinite(+n) ? +n : 0;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}
function stars(r) { const value = Number.isFinite(+r) ? +r : 0; return `⭐ ${value.toFixed(1)}`; }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttribute(value) { return escapeHtml(value ?? ''); }
function slugify(value) { return String(value ?? '').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function titleCase(value) { return String(value || '').replace(/[-_]/g, " ").replace(/\b\w/g, s => s.toUpperCase()); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function fallbackForCategory(category) {
  const key = category === 'sleep-systems' ? 'sleep-systems' : (category || 'tents');
  return `assets/images/categories/${key}.svg`;
}
function normalizeImage(product) {
  const candidate = product && (product.ebayImage || product.image);
  const url = candidate || fallbackForCategory(product?.category || 'tents');
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) return url;
  return `${url}${String(url).includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
}
function attachImgFallback(img, category) {
  img.addEventListener('error', () => { img.src = fallbackForCategory(category || 'tents'); }, { once: true });
}
function enhanceImages(root = document) {
  root.querySelectorAll('img[data-category]').forEach(img => attachImgFallback(img, img.dataset.category));
}

function cleanCategoryRoute(slug) {
  const key = String(slug || '').trim();
  if (!key) return '/categories';
  if (key === 'sleep-systems') return '/sleeping-bags';
  return `/${encodeURIComponent(key)}`;
}
function categoryLink(catOrSlug) {
  if (typeof catOrSlug === 'object' && catOrSlug) return catOrSlug.page || cleanCategoryRoute(catOrSlug.slug);
  const slug = String(catOrSlug || '');
  const cat = getCategories().find(item => item.slug === slug);
  return cat?.page || cleanCategoryRoute(slug);
}
function productLink(product) { return `/products/${encodeURIComponent(product.slug)}`; }
function categoryParam() { return new URLSearchParams(location.search).get('category'); }
function slugParam() { return new URLSearchParams(location.search).get('slug'); }
function bySlug(list, slug) { return list.find(x => slugify(x.slug || x.name) === slugify(slug)); }

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
      finalUrl = `https://www.amazon.com.au/s?k=${encodeURIComponent(productName || 'camping gear')}&tag=${amazonTag}`;
    }
  }

  const isEbay = lowerName.includes('ebay') || /ebay\.[a-z.]+/i.test(finalUrl);
  if (isEbay) {
    finalUrl = finalUrl.replace('campid=%253CePN%253E','campid=5339145146').replace('campid=%3CePN%3E','campid=5339145146').replace('campid=<ePN>','campid=5339145146');
    if (!/[?&]campid=/.test(finalUrl)) {
    try {
      const ep = new URL(finalUrl, window.location.origin);
      ep.searchParams.set('mkcid','1');
      ep.searchParams.set('mkrid','705-53470-19255-0');
      ep.searchParams.set('siteid','15');
      ep.searchParams.set('campid','5339145146');
      ep.searchParams.set('toolid','10001');
      ep.searchParams.set('mkevt','1');
      finalUrl = ep.toString();
    } catch (e) {}
    }
  }
  return finalUrl;
}

function productSearchText(product) {
  return [product.name, product.brand, product.categoryName, product.category, product.summary, product.description, ...(product.highlights || [])].join(' ').toLowerCase();
}

function isBadCapacityValue(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === '00 person' || text === '0 person' || text === '00-person' || text === '0-person' || text === '00p' || text === '0p' || text === 'capacity: 00 person';
}

function sanitizeHighlightValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/capacity:\s*00\s*person/i.test(text)) return '';
  if (/00[- ]?person/i.test(text)) return '';
  if (/0[- ]?person/i.test(text)) return '';
  return text;
}

function sanitizeProduct(product) {
  if (!product || typeof product !== 'object') return product;
  const copy = { ...product };
  copy.highlights = (copy.highlights || []).map(sanitizeHighlightValue).filter(Boolean);
  if (copy.specs && typeof copy.specs === 'object') {
    const nextSpecs = {};
    Object.entries(copy.specs).forEach(([key, value]) => {
      if (String(key || '').toLowerCase() === 'capacity' && isBadCapacityValue(value)) return;
      nextSpecs[key] = value;
    });
    copy.specs = nextSpecs;
  }
  return copy;
}

function inferTentCapacity(text) {
  const match = text.match(/(\d{1,2})\s*(?:p\b|person\b|people\b)/i);
  if (match) return `${match[1]}P`;
  if (/family/i.test(text)) return 'Family';
  return 'General';
}
function inferCapacity(product) {
  const text = `${product.name} ${product.summary || ''}`;
  if (product.category === 'tents') return inferTentCapacity(text);
  if (product.category === 'coolers') {
    const liters = text.match(/(\d{1,3})\s*l\b/i);
    if (liters) return `${liters[1]}L`;
    return /wheeled/i.test(text) ? 'Large' : 'Compact';
  }
  if (product.category === 'chairs') return /double|love/i.test(text) ? '2 seat' : (/low/i.test(text) ? 'Low profile' : '1 seat');
  if (product.category === 'sleep-systems') return /double|queen/i.test(text) ? '2 person' : '1 person';
  return /compact|small|mini/i.test(text) ? 'Compact' : 'Standard';
}

function inferType(product) {
  const text = `${product.name} ${product.summary || ''} ${(product.highlights || []).join(' ')}`.toLowerCase();
  const cat = product.category;
  if (cat === 'tents') {
    if (/dark.?room/.test(text)) return 'Dark-room tent';
    if (/instant|fast frame|fast-frame|quick/.test(text)) return 'Instant tent';
    if (/swag/.test(text)) return 'Swag';
    if (/dome/.test(text)) return 'Dome tent';
    if (/tunnel/.test(text)) return 'Tunnel tent';
    if (/tour/i.test(text)) return 'Touring tent';
    if (/family/.test(text)) return 'Family tent';
    return 'Camping tent';
  }
  if (cat === 'chairs') {
    if (/love|double/.test(text)) return 'Loveseat';
    if (/recliner|recline/.test(text)) return 'Recliner';
    if (/directors/.test(text)) return 'Directors chair';
    if (/low/.test(text)) return 'Low chair';
    if (/compact|packable|helinox|light/.test(text)) return 'Compact chair';
    return 'Camping chair';
  }
  if (cat === 'coolers') {
    if (/fridge|electric/.test(text)) return 'Portable fridge';
    if (/wheeled|wheel/.test(text)) return 'Wheeled cooler';
    if (/soft/.test(text)) return 'Soft cooler';
    return 'Hard cooler';
  }
  if (cat === 'stoves') {
    if (/dual|2 burner|2-burner|two burner/.test(text)) return '2-burner stove';
    if (/single|1 burner|1-burner|backpacking|jetboil/.test(text)) return 'Single burner';
    if (/grill|griddle/.test(text)) return 'Grill stove';
    return 'Camping stove';
  }
  if (cat === 'lanterns') {
    if (/gas/.test(text)) return 'Gas lantern';
    if (/recharge/.test(text)) return 'Rechargeable lantern';
    if (/headlamp/.test(text)) return 'Headlamp';
    return 'LED lantern';
  }
  if (cat === 'sleep-systems') {
    if (/mat|pad/.test(text)) return 'Sleeping mat';
    if (/stretcher|cot/.test(text)) return 'Camp stretcher';
    if (/quilt/.test(text)) return 'Camping quilt';
    return 'Sleeping bag';
  }
  return titleCase(cat);
}

function inferUse(product) {
  const text = `${product.name} ${product.summary || ''} ${(product.highlights || []).join(' ')}`.toLowerCase();
  if (/family|weekend|car camping/.test(text)) return 'Family trips';
  if (/backpack|ultra|lightweight|hike/.test(text)) return 'Lightweight trips';
  if (/beach|park/.test(text)) return 'Day trips';
  if (/tour|4wd|overland/.test(text)) return 'Touring';
  return 'General camping';
}

function priceBand(price) {
  const n = Number(price) || 0;
  if (n < 100) return 'Under $100';
  if (n < 200) return '$100–$199';
  if (n < 350) return '$200–$349';
  if (n < 600) return '$350–$599';
  return '$600+';
}
function ratingBand(rating) {
  const value = Number(rating) || 0;
  if (value >= 4.7) return '4.7+';
  if (value >= 4.5) return '4.5+';
  if (value >= 4.2) return '4.2+';
  return '4.0+';
}
function savingsPercent(product) {
  const price = Number(product.price) || 0;
  const sale = Number(product.salePrice) || 0;
  if (!price || !sale || sale >= price) return 0;
  return Math.round((price - sale) / price * 100);
}
const JUNK_LISTING_PATTERN = /faulty|not\s*working|doesn'?t\s*work|no\s*power|spares?\s*(or|and)?\s*repair|for\s*parts|parts\s*only|broken|damaged|cracked\s*screen|dead\s*pixel|water\s*damage|as[\s-]is\b/i;
function isJunkListing(product) {
  return JUNK_LISTING_PATTERN.test(`${product.name || ''} ${product.summary || ''}`);
}
function reviewScore(product) {
  if (isJunkListing(product)) return -1;
  return ((Number(product.rating) || 0) * 100) + Math.log10((Number(product.reviews) || 1) + 1) * 18;
}
function getPrimarySpecs(product) {
  return [inferType(product), inferCapacity(product), priceBand(product.salePrice), inferUse(product)].filter(Boolean);
}
function getDetailSpecs(product) {
  const storeCount = (product.stores || []).length;
  return {
    Brand: product.brand || '—',
    Category: product.categoryName || titleCase(product.category),
    Type: inferType(product),
    'Best for': inferUse(product),
    Capacity: inferCapacity(product),
    'Reference price': currency(product.salePrice),
    'Typical full price': product.price ? currency(product.price) : '—',
    'Store options': `${storeCount} stores`,
    Rating: `${(Number(product.rating)||0).toFixed(1)} / 5`,
    Reviews: `${product.reviews || 0} reviews`
  };
}

function normalizeStores(product) {
  const seen = new Set();
  const list = (product.stores || []).map((store, index) => {
    const name = store.name || `Store ${index + 1}`;
    const key = slugify(name);
    if (seen.has(key)) return null;
    seen.add(key);
    const url = buildAffiliateUrl(name, store.url || '#', product.name || '');
    const lower = name.toLowerCase();
    let note = 'Search results';
    if (/ebay/.test(lower)) note = 'Marketplace listings';
    if (/amazon/.test(lower)) note = 'Store search';
    if (/bcf|anaconda|snowys|tentworld|wild earth/.test(lower)) note = 'Retail search';
    return { name, url, note };
  }).filter(Boolean);
  return list;
}

function createStoreButtons(product, limit = 4) {
  return normalizeStores(product).slice(0, limit).map(store => `
    <a class="store-pill small secondary" target="_blank" rel="noopener sponsored" href="${escapeAttribute(store.url)}">${escapeHtml(store.name)}</a>
  `).join('');
}

function productCard(product) {
  product = sanitizeProduct(product);
  const hl = (product.highlights || []).slice(0,2).map(v => `<span class="dw-row-hl">${escapeHtml(v)}</span>`).join('');
  const ratingVal = Number(product.rating) || 0;
  const saving = savingsPercent(product);
  return `
  <article class="dw-grid-item">
    <a class="dw-grid-thumb" href="${productLink(product)}">
      <img src="${normalizeImage(product)}" alt="${escapeHtml(product.name)}" loading="lazy" data-category="${product.category}">
    </a>
    <div class="dw-grid-body">
      <div class="dw-row-brand">
        <strong>${escapeHtml(product.brand)}</strong>
        <span class="soft-badge">${escapeHtml(inferType(product))}</span>
      </div>
      <a href="${productLink(product)}" class="dw-grid-title">${escapeHtml(product.name)}</a>
      ${hl ? `<div class="dw-row-highlights" style="margin:2px 0">${hl}</div>` : ''}
      <div class="dw-grid-price">${currency(product.salePrice)}</div>
      <div class="dw-grid-meta">
        ${ratingVal ? `⭐ ${ratingVal.toFixed(1)}` : ''} ${product.reviews ? `· ${product.reviews} reviews` : ''}
        ${saving ? `<span class="save-badge" style="margin-left:4px">-${saving}%</span>` : ''}
      </div>
      <a class="dw-grid-btn" href="${productLink(product)}">Compare →</a>
    </div>
  </article>`;
}

function compareRow(product) {
  product = sanitizeProduct(product);
  const specs = getPrimarySpecs(product).map(v => `<span class="dw-row-spec">${escapeHtml(v)}</span>`).join('');
  const highlights = (product.highlights || []).slice(0,3).map(v => `<span class="dw-row-hl">${escapeHtml(v)}</span>`).join('');
  const saving = savingsPercent(product);
  const stores = normalizeStores(product).slice(0, 3).map(store =>
    `<div class="dw-row-store"><span>${escapeHtml(store.name)}</span><a target="_blank" rel="noopener sponsored" href="${escapeAttribute(store.url)}">Open ↗</a></div>`
  ).join('');
  const ratingVal = Number(product.rating) || 0;
  const starsHtml = ratingVal ? `<span class="stars">${'★'.repeat(Math.round(ratingVal))}${'☆'.repeat(5-Math.round(ratingVal))}</span> ${ratingVal.toFixed(1)}` : '';
  return `
  <article class="dw-row-item">
    <a class="dw-row-img" href="${productLink(product)}">
      <img src="${normalizeImage(product)}" alt="${escapeHtml(product.name)}" loading="lazy" data-category="${product.category}">
    </a>
    <div class="dw-row-info">
      <div class="dw-row-brand">
        <strong>${escapeHtml(product.brand)}</strong>
        <span class="soft-badge">${escapeHtml(product.categoryName || titleCase(product.category))}</span>
      </div>
      <a class="dw-row-title" href="${productLink(product)}">${escapeHtml(product.name)}</a>
      <p class="dw-row-summary">${escapeHtml((product.summary || '').slice(0,120))}${(product.summary||'').length>120?'…':''}</p>
      ${highlights ? `<div class="dw-row-highlights">${highlights}</div>` : specs ? `<div class="dw-row-specs">${specs}</div>` : ''}
      <div class="dw-row-meta">
        ${starsHtml ? `${starsHtml}` : ''}
        ${product.reviews ? `<span>${product.reviews} reviews</span>` : ''}
        ${saving ? `<span class="save-badge">Save ~${saving}%</span>` : ''}
      </div>
    </div>
    <div class="dw-row-price">
      <div class="sale-price">${currency(product.salePrice)}</div>
      ${product.price && product.price !== product.salePrice ? `<div class="orig-price">${currency(product.price)}</div>` : ''}
      <div class="dw-row-stores">${stores}</div>
      <a class="dw-row-compare-btn" href="${productLink(product)}">Compare →</a>
    </div>
  </article>`;
}

function categoryCard(cat, count, products = []) {
  const subset = products.filter(item => item.category === cat.slug);
  const topBrands = [...new Set(subset.slice(0, 50).map(item => item.brand).filter(Boolean))].slice(0, 4);
  const startPrice = subset.length ? Math.min(...subset.map(item => Number(item.salePrice) || 0).filter(Boolean)) : 0;
  return `
  <article class="hub-card">
    <a href="${categoryLink(cat)}"><img src="${subset[0] ? normalizeImage(subset[0]) : `assets/images/categories/${cat.slug}.svg`}" alt="${escapeHtml(cat.name)}" data-category="${cat.slug}"></a>
    <div>
      <div class="metric-row"><span class="badge">${count} compare pages</span>${startPrice ? `<span class="soft-badge">From ${currency(startPrice)}</span>` : ''}</div>
      <a class="title" style="font-size:1.25rem;margin-top:10px" href="${categoryLink(cat)}">${escapeHtml(cat.name)}</a>
      <p class="muted">${escapeHtml(cat.description || '')}</p>
      <div class="hub-stats">${topBrands.map(brand => `<span class="soft-badge">${escapeHtml(brand)}</span>`).join('')}</div>
    </div>
    <div><a class="btn small" href="${categoryLink(cat)}">Open</a></div>
  </article>`;
}

function setupSearchForm(root = document) {
  root.querySelectorAll('[data-search-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('input[name="q"]');
      const q = input ? input.value.trim() : '';
      location.href = `/search?q=${encodeURIComponent(q)}`;
    });
  });
}

function sortProducts(list, sortKey) {
  const items = [...list];
  switch (sortKey) {
    case 'price-asc': return items.sort((a,b) => (a.salePrice||0) - (b.salePrice||0));
    case 'price-desc': return items.sort((a,b) => (b.salePrice||0) - (a.salePrice||0));
    case 'reviews': return items.sort((a,b) => (b.reviews||0) - (a.reviews||0));
    case 'rating': return items.sort((a,b) => (b.rating||0) - (a.rating||0) || (b.reviews||0) - (a.reviews||0));
    default: return items.sort((a,b) => reviewScore(b) - reviewScore(a));
  }
}

function getCategoryCounts(products) {
  return products.reduce((acc, product) => { acc[product.category] = (acc[product.category] || 0) + 1; return acc; }, {});
}

function topBrandsFor(products, limit = 10) {
  const counts = {};
  products.forEach(product => { counts[product.brand] = (counts[product.brand] || 0) + 1; });
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, limit);
}

function rankProducts(products, limit = 20) { return sortProducts(products, 'recommended').slice(0, limit); }

const _imgCache = {};
async function _fetchProductImage(product) {
  try {
    const res = await fetch(`/api/ebay-search?q=${encodeURIComponent(product.name)}&limit=1`);
    if (res.ok) { const data = await res.json(); const img = data.products?.[0]?.image || data.items?.[0]?.image; if (img) return img; }
  } catch (e) {}
  try {
    const q = encodeURIComponent(`${product.name} ${product.brand || ''}`);
    const res = await fetch(`/api/google-search?q=${q}&num=1`);
    if (res.ok) { const data = await res.json(); const img = data.items?.[0]?.image; if (img) return img; }
  } catch (e) {}
  return null;
}
function _applyImage(slug, imageUrl) {
  document.querySelectorAll(`img[data-slug="${slug}"]`).forEach(img => { img.src = imageUrl; img.style.objectFit='contain'; img.style.padding='8px'; img.style.background='rgba(255,255,255,.98)'; });
}
async function loadEbayImagesForCards(products) {
  for (const product of products) {
    if (_imgCache[product.slug]) { _applyImage(product.slug, _imgCache[product.slug]); continue; }
    const url = await _fetchProductImage(product);
    if (url) { _imgCache[product.slug] = url; _applyImage(product.slug, url); }
    await new Promise(r => setTimeout(r, 180));
  }
}
