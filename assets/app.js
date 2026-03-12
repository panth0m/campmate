async function fetchEbayResults(query) {
  const res = await fetch(`/.netlify/functions/ebay-search?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "eBay search failed");
  }

  const items = (data.items || data.products || []).map((item) => ({
    id: item.id || item.url,
    title: item.title || "",
    url: item.url || "#",
    image: item.image || "",
    price: item.price || "",
    currency: item.currency || "AUD",
    shipping: item.shipping || "0",
    freeShipping: !!item.freeShipping,
    condition: item.condition || "",
    source: "eBay",
    type: "ebay",
    score: Number(item.feedbackPct || 0),
    sellerScore: Number(item.feedbackScore || 0),
    snippet: item.condition ? `Condition: ${item.condition}` : "",
  }));

  return items;
}

async function fetchGoogleResults(query) {
  const res = await fetch(`/.netlify/functions/google-search?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Google search failed");
  }

  const items = (data.items || []).map((item) => ({
    id: item.id || item.url,
    title: item.title || "",
    url: item.url || "#",
    image: item.image || "",
    price: "",
    currency: "AUD",
    shipping: "",
    freeShipping: false,
    condition: "",
    source: item.source || "Store",
    type: "google",
    score: 0,
    sellerScore: 0,
    snippet: item.snippet || "",
  }));

  return items;
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === "") return Number.POSITIVE_INFINITY;
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
}

function sortResults(items, sortBy = "best") {
  const list = [...items];

  if (sortBy === "price") {
    return list.sort((a, b) => normalizePrice(a.price) - normalizePrice(b.price));
  }

  if (sortBy === "rating") {
    return list.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return list;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCombinedResults(items, containerSelector = "#results") {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>검색 결과가 없습니다. 다른 키워드를 시도해 보세요.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const priceHtml =
        item.price && normalizePrice(item.price) !== Number.POSITIVE_INFINITY
          ? `<div class="deal-price">$${escapeHtml(item.price)} ${escapeHtml(item.currency || "AUD")}</div>`
          : `<div class="deal-price deal-price-muted">가격 확인</div>`;

      const shippingHtml =
        item.type === "ebay"
          ? `<div class="deal-meta">${item.freeShipping ? "Free shipping" : `Shipping: $${escapeHtml(item.shipping || "0")}`}</div>`
          : `<div class="deal-meta">${escapeHtml(item.source || "Store")}</div>`;

      const imageHtml = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
        : `<div class="deal-image-placeholder">No image</div>`;

      const badge = item.type === "ebay"
        ? `<span class="deal-badge ebay-badge">eBay</span>`
        : `<span class="deal-badge store-badge">${escapeHtml(item.source || "Store")}</span>`;

      const subText = item.type === "ebay"
        ? `${escapeHtml(item.condition || "")}${item.score ? ` · ${escapeHtml(item.score)}% positive` : ""}`
        : escapeHtml(item.snippet || "");

      return `
        <a class="deal-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
          <div class="deal-image-wrap">
            ${imageHtml}
            ${badge}
          </div>
          <div class="deal-body">
            <h3 class="deal-title">${escapeHtml(item.title)}</h3>
            ${priceHtml}
            <div class="deal-subtext">${subText}</div>
            ${shippingHtml}
          </div>
        </a>
      `;
    })
    .join("");
}

async function searchAllSources(query, sortBy = "best") {
  const loadingEl = document.querySelector("#results");
  if (loadingEl) {
    loadingEl.innerHTML = `<div class="loading-state">검색 중...</div>`;
  }

  try {
    const [ebayResults, googleResults] = await Promise.allSettled([
      fetchEbayResults(query),
      fetchGoogleResults(query),
    ]);

    const ebayItems = ebayResults.status === "fulfilled" ? ebayResults.value : [];
    const googleItems = googleResults.status === "fulfilled" ? googleResults.value : [];

    const combined = sortResults([...ebayItems, ...googleItems], sortBy);
    renderCombinedResults(combined, "#results");

    console.log("eBay:", ebayItems.length, "Google:", googleItems.length);
    if (ebayResults.status === "rejected") console.error("eBay error:", ebayResults.reason);
    if (googleResults.status === "rejected") console.error("Google error:", googleResults.reason);
  } catch (error) {
    console.error(error);
    const container = document.querySelector("#results");
    if (container) {
      container.innerHTML = `<div class="empty-state"><p>검색 중 오류가 발생했습니다.</p></div>`;
    }
  }
}
