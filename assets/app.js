const storeIcons = {
  bcf: '🧭',
  anaconda: '🏕️',
  snowys: '❄️',
  tentworld: '⛺',
  'paddypallin.com.au': '🎒',
  'wild earth': '🦘',
  rebelsport: '🏃',
  default: '🛒',
};

let currentSort = 'best';
let currentQuery = 'camping tent';

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(price, currency = 'AUD') {
  const num = normalizePrice(price);
  if (!Number.isFinite(num)) return 'Visit store';
  return `$${num.toFixed(2)} ${currency}`;
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return Number.POSITIVE_INFINITY;
  const cleaned = String(value).replace(/,/g, '').replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
}

function extractPriceFromText(text = '') {
  const patterns = [
    /(?:AU\$|A\$|\$)\s?(\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?)/i,
    /(\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?)\s?AUD/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function getStoreEmoji(source = '') {
  const key = source.toLowerCase();
  for (const entry of Object.keys(storeIcons)) {
    if (key.includes(entry)) return storeIcons[entry];
  }
  return storeIcons.default;
}

function updateSummary(text) {
  const bar = $('#summaryBar');
  if (bar) bar.textContent = text;
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

async function fetchEbayResults(query) {
  const data = await fetchJson(`/.netlify/functions/ebay-search?q=${encodeURIComponent(query)}`);
  return (data.items || data.products || []).map((item) => ({
    type: 'ebay',
    id: item.id || item.url,
    title: item.title || '',
    url: item.url || '#',
    image: item.image || '',
    price: item.price || '',
    currency: item.currency || 'AUD',
    shipping: item.shipping || '0',
    freeShipping: !!item.freeShipping,
    condition: item.condition || '',
    score: Number(item.feedbackPct || 0),
    sellerScore: Number(item.feedbackScore || 0),
    source: 'eBay',
    snippet: item.condition ? `Condition: ${item.condition}` : '',
  }));
}

async function fetchStoreResults(query) {
  const data = await fetchJson(`/.netlify/functions/google-search?q=${encodeURIComponent(query)}`);
  return (data.items || []).map((item) => ({
    type: 'store',
    id: item.id || item.url,
    title: item.title || '',
    url: item.url || '#',
    image: item.image || '',
    price: item.price || extractPriceFromText(item.snippet || ''),
    currency: 'AUD',
    shipping: '',
    freeShipping: false,
    condition: '',
    score: 0,
    sellerScore: 0,
    source: item.source || 'Store',
    snippet: item.snippet || '',
  }));
}

function setLoading(containerSelector, text) {
  const el = $(containerSelector);
  if (!el) return;
  el.innerHTML = `<div class="loading-card">${escapeHtml(text)}</div>`;
}

function setEmpty(containerSelector, text) {
  const el = $(containerSelector);
  if (!el) return;
  el.innerHTML = `<div class="empty-card">${escapeHtml(text)}</div>`;
}

function sortItems(items, sortBy) {
  const cloned = [...items];

  if (sortBy === 'price') {
    return cloned.sort((a, b) => normalizePrice(a.price) - normalizePrice(b.price));
  }

  if (sortBy === 'rating') {
    return cloned.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return cloned;
}

function renderCards(items, containerSelector) {
  const el = $(containerSelector);
  if (!el) return;

  if (!items.length) {
    setEmpty(containerSelector, '검색 결과가 없습니다. 다른 키워드를 시도해 보세요.');
    return;
  }

  el.innerHTML = items.map((item) => {
    const badgeClass = item.type === 'ebay' ? 'ebay' : 'store';
    const badgeLabel = item.type === 'ebay' ? 'EBAY LIVE' : 'STORE';
    const imageHtml = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<div class="deal-image-placeholder">${escapeHtml(getStoreEmoji(item.source))}</div>`;

    const metaText = item.type === 'ebay'
      ? `${item.freeShipping ? 'Free shipping' : `Shipping: $${escapeHtml(item.shipping || '0')}`} · ${escapeHtml(item.condition || 'Listing')}`
      : escapeHtml(item.snippet || item.source || 'Store result');

    const subText = item.type === 'ebay'
      ? `${item.score ? `${escapeHtml(String(item.score))}% positive` : 'Live listing'}${item.sellerScore ? ` · ${escapeHtml(String(item.sellerScore))} feedback` : ''}`
      : `Result from ${escapeHtml(item.source)}`;

    const ctaText = item.type === 'ebay' ? 'Open eBay ↗' : `Open ${escapeHtml(item.source)} ↗`;
    const price = normalizePrice(item.price);
    const priceHtml = Number.isFinite(price)
      ? `<div class="deal-price">${escapeHtml(formatMoney(item.price, item.currency))}</div>`
      : `<div class="deal-price muted">Visit store</div>`;

    return `
      <a class="deal-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
        <div class="deal-image-wrap">
          ${imageHtml}
          <span class="deal-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="deal-body">
          <div class="deal-source">${escapeHtml(item.source)}</div>
          <h3 class="deal-title">${escapeHtml(item.title)}</h3>
          ${priceHtml}
          <div class="deal-subtext">${subText}</div>
          <div class="deal-meta">${metaText}</div>
          <div class="cta">${ctaText}</div>
        </div>
      </a>
    `;
  }).join('');
}

async function runSearch(query, sortBy = 'best') {
  currentQuery = query.trim() || 'camping tent';
  currentSort = sortBy;

  setLoading('#ebayResults', 'Loading eBay live prices...');
  setLoading('#storeResults', 'Loading store compare results...');
  updateSummary(`Searching for “${currentQuery}”...`);

  const [ebaySettled, storeSettled] = await Promise.allSettled([
    fetchEbayResults(currentQuery),
    fetchStoreResults(`${currentQuery} australia price`),
  ]);

  const ebayItems = ebaySettled.status === 'fulfilled' ? sortItems(ebaySettled.value, sortBy) : [];
  const storeItems = storeSettled.status === 'fulfilled' ? sortItems(storeSettled.value, sortBy) : [];

  if (ebaySettled.status === 'rejected') {
    console.error('eBay error:', ebaySettled.reason);
    setEmpty('#ebayResults', 'eBay 결과를 불러오지 못했습니다. 환경변수나 API 응답을 확인해 주세요.');
  } else {
    renderCards(ebayItems, '#ebayResults');
  }

  if (storeSettled.status === 'rejected') {
    console.error('Store error:', storeSettled.reason);
    setEmpty('#storeResults', '스토어 결과를 불러오지 못했습니다. Google API 설정을 확인해 주세요.');
  } else {
    renderCards(storeItems, '#storeResults');
  }

  const bestStorePrice = storeItems
    .map((item) => normalizePrice(item.price))
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b)[0];

  const bestEbayPrice = ebayItems
    .map((item) => normalizePrice(item.price))
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b)[0];

  const ebayText = Number.isFinite(bestEbayPrice) ? `Lowest eBay: $${bestEbayPrice.toFixed(2)}` : 'No live eBay price found';
  const storeText = Number.isFinite(bestStorePrice) ? `Lowest store snippet price: $${bestStorePrice.toFixed(2)}` : 'No store snippet price found';
  updateSummary(`Search complete for “${currentQuery}”. ${ebayText}. ${storeText}.`);
}

function setActiveSortButton(activeId) {
  ['#sortBest', '#sortPrice', '#sortRating'].forEach((id) => {
    const btn = $(id);
    if (btn) btn.classList.toggle('active', id === activeId);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = $('#searchInput');
  const button = $('#searchButton');

  button?.addEventListener('click', () => runSearch(input?.value || currentQuery, currentSort));
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch(input.value || currentQuery, currentSort);
  });

  $('#sortBest')?.addEventListener('click', () => {
    setActiveSortButton('#sortBest');
    runSearch(input?.value || currentQuery, 'best');
  });

  $('#sortPrice')?.addEventListener('click', () => {
    setActiveSortButton('#sortPrice');
    runSearch(input?.value || currentQuery, 'price');
  });

  $('#sortRating')?.addEventListener('click', () => {
    setActiveSortButton('#sortRating');
    runSearch(input?.value || currentQuery, 'rating');
  });

  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const query = btn.dataset.query || 'camping gear';
      if (input) input.value = query;
      runSearch(query, currentSort);
    });
  });

  runSearch(currentQuery, currentSort);
});
