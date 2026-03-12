const STORE_DEFINITIONS = [
  { name: "BCF", color: "#7de0ff", buildUrl: q => `https://www.bcf.com.au/search?q=${encodeURIComponent(q)}` },
  { name: "Anaconda", color: "#ffbd7d", buildUrl: q => `https://www.anacondastores.com/search?text=${encodeURIComponent(q)}` },
  { name: "Snowys", color: "#a6ff9c", buildUrl: q => `https://www.snowys.com.au/search?q=${encodeURIComponent(q)}` },
  { name: "Tentworld", color: "#ff95de", buildUrl: q => `https://www.tentworld.com.au/Search?query=${encodeURIComponent(q)}` },
  { name: "Paddy Pallin", color: "#d7c3ff", buildUrl: q => `https://www.paddypallin.com.au/catalogsearch/result/?q=${encodeURIComponent(q)}` },
  { name: "Wild Earth", color: "#ffe17a", buildUrl: q => `https://www.wildearth.com.au/search?type=product&q=${encodeURIComponent(q)}` },
  { name: "Rebel Sport", color: "#a2b7ff", buildUrl: q => `https://www.rebelsport.com.au/search?q=${encodeURIComponent(q)}` }
];

const CATEGORY_META = {
  tents: { label: "Tents", desc: "Family, touring and hiking tents" },
  stoves: { label: "Stoves", desc: "Boil systems and camp cookers" },
  chairs: { label: "Chairs", desc: "Compact and family camp seating" },
  coolers: { label: "Coolers", desc: "Ice boxes and roto coolers" },
  lanterns: { label: "Lanterns", desc: "Camp lighting and rechargeable lamps" },
  "sleeping-bags": { label: "Sleeping Bags", desc: "Warm weather and 3-season bags" }
};

const state = {
  products: [],
  selectedProduct: null,
  currentSort: "best",
  categoryFilter: "all",
  textFilter: ""
};

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value, currency = "AUD") {
  if (value === null || value === undefined || value === "") return "Check price";
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return String(value);
  return `${currency} $${num.toFixed(2)}`;
}

function normalizePrice(value) {
  const num = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
}

function getFilteredProducts() {
  return state.products.filter(product => {
    const categoryOk = state.categoryFilter === "all" || product.category === state.categoryFilter;
    const text = state.textFilter.trim().toLowerCase();
    const textOk = !text || [product.name, product.brand, product.summary, product.category].join(" ").toLowerCase().includes(text);
    return categoryOk && textOk;
  });
}

function renderCategories() {
  const categoryGrid = document.getElementById("categoryGrid");
  categoryGrid.innerHTML = Object.entries(CATEGORY_META).map(([key, meta]) => `
    <button class="category-card" type="button" data-category="${key}">
      <strong>${meta.label}</strong>
      <span>${meta.desc}</span>
      <span class="pill">Open category</span>
    </button>
  `).join("");

  categoryGrid.querySelectorAll("[data-category]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.categoryFilter = btn.dataset.category;
      document.getElementById("categoryFilter").value = state.categoryFilter;
      renderProducts();
      window.location.hash = "popular";
    });
  });
}

function populateCategorySelect() {
  const select = document.getElementById("categoryFilter");
  Object.entries(CATEGORY_META).forEach(([key, meta]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = meta.label;
    select.appendChild(opt);
  });
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  const template = document.getElementById("productCardTemplate");
  const items = getFilteredProducts();
  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">No products matched that filter.</div>`;
    return;
  }

  items.forEach(product => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector("img").src = product.image;
    fragment.querySelector("img").alt = product.name;
    fragment.querySelector(".category-pill").textContent = CATEGORY_META[product.category]?.label || product.category;
    fragment.querySelector("h3").textContent = product.name;
    fragment.querySelector(".product-card-summary").textContent = product.summary;
    fragment.querySelector(".brand").textContent = product.brand;
    fragment.querySelector(".compare-link").addEventListener("click", () => selectProduct(product));
    fragment.querySelector(".product-card").addEventListener("click", () => selectProduct(product));
    grid.appendChild(fragment);
  });
}

function renderProductDetail(product) {
  const detail = document.getElementById("productDetail");
  detail.innerHTML = `
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
    <div class="detail-meta">
      <span class="pill">${escapeHtml(CATEGORY_META[product.category]?.label || product.category)}</span>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="detail-summary">${escapeHtml(product.summary)}</p>
      <p><strong>Brand:</strong> ${escapeHtml(product.brand)}</p>
      <p><strong>Compare query:</strong> ${escapeHtml(product.storesQuery || product.keywords)}</p>
    </div>
  `;
  document.getElementById("compareTitle").textContent = product.name;
}

function renderStores(product) {
  const storeGrid = document.getElementById("storeGrid");
  const query = product.storesQuery || product.keywords || product.name;

  storeGrid.innerHTML = STORE_DEFINITIONS.map(store => `
    <article class="store-card">
      <div class="store-top">
        <strong>${escapeHtml(store.name)}</strong>
        <span class="pill" style="color:${store.color};">Store</span>
      </div>
      <div class="store-copy">
        <p>Search this exact product directly on ${escapeHtml(store.name)}.</p>
      </div>
      <a class="store-btn" href="${store.buildUrl(query)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(store.name)}</a>
    </article>
  `).join("");
}

async function fetchEbayResults(query) {
  const res = await fetch(`/.netlify/functions/ebay-search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "eBay search failed");
  }
  return (data.items || []).map(item => ({
    title: item.title || "Untitled listing",
    url: item.url || "#",
    image: item.image || "",
    price: item.price || "",
    currency: item.currency || "AUD",
    shipping: item.shipping || "",
    freeShipping: !!item.freeShipping,
    condition: item.condition || "",
    score: Number(item.feedbackPct || 0),
    sellerScore: Number(item.feedbackScore || 0)
  }));
}

function sortDeals(items) {
  const list = [...items];
  if (state.currentSort === "price") return list.sort((a, b) => normalizePrice(a.price) - normalizePrice(b.price));
  if (state.currentSort === "rating") return list.sort((a, b) => (b.score || 0) - (a.score || 0));
  return list;
}

function renderDeals(items) {
  const ebayResults = document.getElementById("ebayResults");
  ebayResults.innerHTML = "";
  if (!items.length) {
    ebayResults.innerHTML = `<div class="empty-state">No live eBay results found for this product.</div>`;
    return;
  }

  sortDeals(items).slice(0, 12).forEach(item => {
    const imageHtml = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<div class="loading-state">No image</div>`;

    const card = document.createElement("a");
    card.className = "deal-card";
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.innerHTML = `
      <div class="deal-image">${imageHtml}</div>
      <div class="deal-body">
        <h4>${escapeHtml(item.title)}</h4>
        <div class="deal-price">${escapeHtml(formatCurrency(item.price, item.currency))}</div>
        <div class="deal-submeta">${escapeHtml(item.condition || "Condition not shown")}</div>
        <div class="deal-submeta">${item.freeShipping ? "Free shipping" : escapeHtml(item.shipping ? `Shipping $${item.shipping}` : "Shipping not shown")}</div>
        <div class="deal-submeta">${item.score ? `${escapeHtml(String(item.score))}% positive` : "Seller rating not shown"}</div>
      </div>
    `;
    ebayResults.appendChild(card);
  });
}

async function loadEbayForProduct(product) {
  const status = document.getElementById("ebayStatus");
  const query = product.keywords || product.storesQuery || product.name;
  status.textContent = `Searching eBay live for: ${query}`;
  document.getElementById("ebayResults").innerHTML = `<div class="loading-state">Loading eBay live results...</div>`;

  try {
    const items = await fetchEbayResults(query);
    status.textContent = `Showing eBay live results for ${product.name}.`;
    renderDeals(items);
  } catch (error) {
    status.textContent = `eBay live compare could not load right now.`;
    document.getElementById("ebayResults").innerHTML = `<div class="empty-state">${escapeHtml(error.message || "eBay results failed to load.")}</div>`;
  }
}

function selectProduct(product) {
  state.selectedProduct = product;
  renderProductDetail(product);
  renderStores(product);
  loadEbayForProduct(product);
  document.getElementById("compare").scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectQuery(query) {
  const matched = state.products.find(product => product.name.toLowerCase().includes(query.toLowerCase()) || product.keywords.toLowerCase().includes(query.toLowerCase()));
  if (matched) {
    selectProduct(matched);
    return;
  }
  const tempProduct = {
    id: `search-${Date.now()}`,
    name: query,
    brand: "Search query",
    category: "tents",
    image: state.products[0]?.image || "",
    summary: "Custom search query compare view.",
    keywords: `${query} australia`,
    storesQuery: query
  };
  renderProductDetail(tempProduct);
  renderStores(tempProduct);
  loadEbayForProduct(tempProduct);
  document.getElementById("compare").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init() {
  const response = await fetch("data/products.json");
  state.products = await response.json();
  populateCategorySelect();
  renderCategories();
  renderProducts();
  selectProduct(state.products[0]);

  document.getElementById("catalogSearch").addEventListener("input", e => {
    state.textFilter = e.target.value;
    renderProducts();
  });

  document.getElementById("categoryFilter").addEventListener("change", e => {
    state.categoryFilter = e.target.value;
    renderProducts();
  });

  document.querySelectorAll(".quick-tag").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("heroSearchInput").value = btn.dataset.query;
      selectQuery(btn.dataset.query);
    });
  });

  document.getElementById("heroSearchForm").addEventListener("submit", e => {
    e.preventDefault();
    const query = document.getElementById("heroSearchInput").value.trim();
    if (query) selectQuery(query);
  });

  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentSort = btn.dataset.sort;
      document.querySelectorAll(".sort-btn").forEach(el => el.classList.toggle("active", el === btn));
      if (state.selectedProduct) loadEbayForProduct(state.selectedProduct);
    });
  });
}

init().catch(error => {
  document.getElementById("productGrid").innerHTML = `<div class="empty-state">Failed to load product catalogue: ${escapeHtml(error.message)}</div>`;
});
