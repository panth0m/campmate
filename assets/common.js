
async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
function currency(n){
  return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n);
}
function stars(r){ return `⭐ ${Number(r).toFixed(1)}`; }
function slugParam(){ return new URLSearchParams(location.search).get('slug'); }
function categoryParam(){ return new URLSearchParams(location.search).get('category'); }
function queryParam(name){ return new URLSearchParams(location.search).get(name); }
function bySlug(list, slug){ return list.find(x => x.slug === slug); }
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function setupSearchForm(){
  const forms = document.querySelectorAll('[data-search-form]');
  forms.forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = form.querySelector('input')?.value?.trim();
      if (!q) return;
      const target = form.dataset.searchTarget || 'search.html';
      location.href = `${target}?q=${encodeURIComponent(q)}`;
    });
  });
}
function badgeHtml(items = []){
  return items.map(x => `<span class="badge subtle">${escapeHtml(x)}</span>`).join('');
}
function productCard(product){
  return `
  <article class="card product-card">
    <a class="thumb" href="product.html?slug=${product.slug}">
      <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">
    </a>
    <div class="card-body">
      <div class="kicker">${escapeHtml(product.brand)} · ${escapeHtml(product.category.replace('-', ' '))}</div>
      <a href="product.html?slug=${product.slug}" class="title">${escapeHtml(product.name)}</a>
      <p>${escapeHtml(product.summary)}</p>
      <div class="price-row">
        <span class="sale">${currency(product.salePrice)}</span>
        <span class="old">${currency(product.price)}</span>
        <span class="save-chip">Save ${currency(Math.max(0, product.price - product.salePrice))}</span>
      </div>
      <div class="meta">
        <span>${stars(product.rating)}</span>
        <span>${product.reviews} reviews</span>
      </div>
      <div class="mini-badges">${badgeHtml(product.badges || [])}</div>
      <div class="actions">
        <a class="btn small" href="product.html?slug=${product.slug}">Open compare</a>
        <a class="btn small secondary" target="_blank" rel="noopener" href="${product.stores?.[0]?.url || '#'}">Open store</a>
      </div>
    </div>
  </article>`;
}
function categoryCard(cat, count){
  return `
  <article class="card cat-card">
    <div class="thumb"><img src="${cat.hero}" alt="${escapeHtml(cat.name)}" loading="lazy"></div>
    <div class="card-body">
      <div class="badge">${count} products</div>
      <div class="title category-title">${escapeHtml(cat.name)}</div>
      <p>${escapeHtml(cat.description)}</p>
      <a class="btn small" href="category.html?category=${cat.slug}">Browse ${escapeHtml(cat.name)}</a>
    </div>
  </article>`;
}
function sortProducts(list, val){
  const arr = [...list];
  if (val === 'price-low') return arr.sort((a,b)=> a.salePrice - b.salePrice);
  if (val === 'price-high') return arr.sort((a,b)=> b.salePrice - a.salePrice);
  if (val === 'rating') return arr.sort((a,b)=> b.rating - a.rating || b.reviews - a.reviews);
  return arr.sort((a,b)=> b.rating - a.rating || (b.reviews - a.reviews));
}
