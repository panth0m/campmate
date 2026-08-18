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
    // A live-matched price (see scripts/scrape_live_prices.py) points at the specific
    // product page; otherwise fall back to the safe generic search link.
    const hasLivePrice = Number.isFinite(Number(store.price)) && Number(store.price) > 0;
    const targetUrl = hasLivePrice && store.matchedUrl ? store.matchedUrl : (store.url || '#');
    const url = buildAffiliateUrl(name, targetUrl, product.name || '');
    const lower = name.toLowerCase();
    let note = 'Search results';
    if (/ebay/.test(lower)) note = 'Marketplace listings';
    if (/amazon/.test(lower)) note = 'Store search';
    if (/bcf|anaconda|snowys|tentworld|wild earth/.test(lower)) note = 'Retail search';
    return { name, url, note, price: hasLivePrice ? Number(store.price) : null, matchedUrl: store.matchedUrl || null };
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
  const stores = normalizeStores(product).slice(0, 3);
  const verified = stores.filter(store => Number(store.price) > 0).sort((a, b) => Number(a.price) - Number(b.price));
  const lowest = verified[0] || null;
  const storeMarkup = stores.map(store => {
    const price = Number(store.price);
    const isLowest = lowest && price === Number(lowest.price);
    const value = Number.isFinite(price) && price > 0
      ? `<a class="store-price-link" data-store="${escapeAttribute(store.name)}" data-price="${price.toFixed(2)}" target="_blank" rel="noopener sponsored" href="${escapeAttribute(store.url)}">${currency(price)} ↗</a>`
      : `<span class="store-price-unverified">Price not verified</span>`;
    return `<div class="dw-row-store${isLowest ? ' is-lowest' : ''}"><span>${escapeHtml(store.name)}</span>${value}</div>`;
  }).join('');
  const ratingVal = Number(product.rating) || 0;
  const starsHtml = ratingVal ? `<span class="stars">${'★'.repeat(Math.round(ratingVal))}${'☆'.repeat(5-Math.round(ratingVal))}</span> ${ratingVal.toFixed(1)}` : '';
  return `
  <article class="dw-row-item" data-product-query="${escapeAttribute(product.name)}">
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
      ${lowest?.url && lowest.url !== '#' ? `<a class="sale-price lowest-price-link" target="_blank" rel="noopener sponsored" href="${escapeAttribute(lowest.url)}">${currency(lowest.price)} ↗</a><div class="price-source">Lowest verified price · ${escapeHtml(lowest.name)}</div>` : `<div class="sale-price">${currency(product.salePrice)}</div><div class="price-source">Reference price</div>`}
      ${product.price && product.price !== product.salePrice ? `<div class="orig-price">${currency(product.price)}</div>` : ''}
      <div class="dw-row-stores">${storeMarkup}</div>
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

// Category rows show verified store prices as links; live eBay may replace the
// eBay row and re-rank the lowest verified offer without inventing prices.
async function setupCategoryLiveEbayPrices(){
  const rows = [...document.querySelectorAll('.dw-row-item[data-product-query]')].slice(0, 24);
  for (const row of rows) {
    const query = row.dataset.productQuery;
    const ebayStore = [...row.querySelectorAll('.dw-row-store')].find(item => /eBay AU/i.test(item.textContent || ''));
    if (!query || !ebayStore) continue;
    try {
      const response = await fetch(`/api/ebay-search?q=${encodeURIComponent(query)}&limit=20`, { headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const data = await response.json();
      const listings = (Array.isArray(data.products) ? data.products : [])
        .filter(item => String(item.condition || '').toLowerCase() === 'new')
        .filter(item => Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE'))
        .filter(item => Number.isFinite(Number(item.price)) && Number(item.price) > 0)
        .sort((a, b) => Number(a.price) - Number(b.price));
      const bestEbay = listings[0];
      if (!bestEbay?.link) continue;
      ebayStore.classList.add('live-offer');
      ebayStore.classList.remove('is-lowest');
      ebayStore.innerHTML = `<span>eBay AU</span><a class="store-price-link" data-store="eBay AU" data-price="${Number(bestEbay.price).toFixed(2)}" target="_blank" rel="noopener sponsored" href="${bestEbay.link}">${currency(bestEbay.price)} ↗</a>`;
      const offers = [...row.querySelectorAll('.store-price-link')]
        .map(link => ({ link, price: Number(link.dataset.price) }))
        .filter(item => Number.isFinite(item.price) && item.price > 0)
        .sort((a, b) => a.price - b.price);
      const lowest = offers[0];
      row.querySelectorAll('.dw-row-store').forEach(store => store.classList.remove('is-lowest'));
      if (lowest) {
        lowest.link.closest('.dw-row-store')?.classList.add('is-lowest');
        const price = row.querySelector('.lowest-price-link') || row.querySelector('.sale-price');
        if (price) {
          price.textContent = `${currency(lowest.price)} ↗`;
          price.classList.add('lowest-price-link');
          price.href = lowest.link.href;
          price.target = '_blank';
          price.rel = 'noopener sponsored';
          const source = row.querySelector('.price-source');
          if (source) source.textContent = `Lowest verified price · ${lowest.link.dataset.store || lowest.link.closest('.dw-row-store')?.querySelector('span')?.textContent || 'store'}`;
        }
      }
    } catch (error) {
      console.warn('Category eBay price unavailable', error);
    }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}

// Live eBay AU price contract: only New + Fixed Price listings may populate the
// comparison row; otherwise the safe static/search-link state remains visible.
async function setupLiveEbayPrice(){
  const table = document.querySelector('#offer-table');
  if (!table) return;
  const heading = document.querySelector('main h1, h1');
  const query = heading?.textContent?.trim();
  const ebayRow = [...table.querySelectorAll('.offer-row')].find(row => /eBay AU/i.test(row.textContent || ''));
  if (!query || !ebayRow || !ebayRow.children[1] || !ebayRow.children[2]) return;
  const link = ebayRow.querySelector('a[href]');
  try {
    const response = await fetch(`/api/ebay-search?q=${encodeURIComponent(query)}&limit=20`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    const listings = (Array.isArray(data.products) ? data.products : [])
      .filter(item => String(item.condition || '').toLowerCase() === 'new')
      .filter(item => Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE'))
      .filter(item => Number.isFinite(Number(item.price)) && Number(item.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price));
    const best = listings[0];
    if (!best) return;
    ebayRow.children[1].innerHTML = `<strong>${currency(best.price)}</strong><span class="soft-badge" style="margin-left:8px">Live · New · Buy It Now</span>`;
    ebayRow.children[2].textContent = 'Just now';
    if (link) {
      link.href = best.link || link.href;
      link.textContent = 'Buy on eBay';
    }
    ebayRow.dataset.livePrice = String(best.price);
    ebayRow.dataset.condition = 'New';
    ebayRow.dataset.buyingOption = 'FIXED_PRICE';
    ebayRow.classList.add('live-offer', 'lowest-offer');
  } catch (error) {
    console.warn('Live eBay price unavailable', error);
  }
}

function observeCategoryLivePrices(){
  const target = document.querySelector('#category-results');
  if (!target || typeof MutationObserver === 'undefined') return;
  let running = false;
  const observer = new MutationObserver(() => {
    if (running || !target.querySelector('.dw-row-item[data-product-query]')) return;
    running = true;
    observer.disconnect();
    setupCategoryLiveEbayPrices().finally(() => {
      running = false;
      observer.observe(target, { childList: true, subtree: true });
    });
  });
  observer.observe(target, { childList: true, subtree: true });
  if (target.querySelector('.dw-row-item[data-product-query]')) {
    running = true;
    observer.disconnect();
    setupCategoryLiveEbayPrices().finally(() => {
      running = false;
      observer.observe(target, { childList: true, subtree: true });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupLiveEbayPrice();
    observeCategoryLivePrices();
  }, { once: true });
} else {
  setupLiveEbayPrice();
  observeCategoryLivePrices();
}
