async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
function currency(n){
  return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n);
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
function productCard(product){
  return `
  <article class="card">
    <a class="thumb" href="product.html?slug=${product.slug}">
      <img src="${normalizeImage(product)}" alt="${escapeHtml(product.name)}" loading="lazy" data-category="${product.category}">
    </a>
    <div class="card-body">
      <div class="kicker">${product.brand} · ${product.category.replace('-', ' ')}</div>
      <a href="product.html?slug=${product.slug}" class="title">${escapeHtml(product.name)}</a>
      <p>${escapeHtml(product.summary)}</p>
      <div class="price-row">
        <span class="sale">${currency(product.salePrice)}</span>
        <span class="old">${currency(product.price)}</span>
      </div>
      <div class="meta">
        <span>${stars(product.rating)}</span>
        <span>${product.reviews} reviews</span>
      </div>
      <div class="actions">
        <a class="btn small" href="product.html?slug=${product.slug}">Open compare</a>
        <a class="btn small secondary" target="_blank" rel="noopener" href="${product.stores[0].url}">Open eBay</a>
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
      <a class="btn small" href="category.html?category=${cat.slug}">Browse ${escapeHtml(cat.name)}</a>
    </div>
  </article>`;
}
function setupSearchForm(){
  const form = document.querySelector('[data-search-form]');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    const target = form.dataset.searchTarget || 'search.html'; location.href = `${target}?q=${encodeURIComponent(q)}`;
  });
}
