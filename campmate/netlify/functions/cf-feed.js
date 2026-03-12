// Commission Factory product feed — runs server-side
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const params  = event.queryStringParameters || {};
    const query   = (params.q || '').toLowerCase();
    const limit   = parseInt(params.limit  || '12', 10);
    const offset  = parseInt(params.offset || '0',  10);

    const CF_FEED_URL = process.env.CF_FEED_URL;

    // ── No CF feed yet → return empty so UI falls through to Google/Direct ──
    if (!CF_FEED_URL) {
      return { statusCode: 200, headers, body: JSON.stringify({ products: [], total: 0, note: 'CF_FEED_URL not set yet' }) };
    }

    const res = await fetch(CF_FEED_URL);
    if (!res.ok) throw new Error(`CF feed fetch failed: ${res.status}`);

    const text = await res.text();

    // ── Parse CSV feed (Commission Factory default format) ──────────────────
    const lines    = text.trim().split('\n');
    const headRaw  = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

    const col = (row, name) => {
      const i = headRaw.indexOf(name);
      return i >= 0 ? row[i]?.replace(/"/g, '').trim() : '';
    };

    let products = lines.slice(1).map(line => {
      // simple CSV split (handles quoted fields)
      const row = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
      return {
        id:           col(row, 'id') || col(row, 'product id'),
        title:        col(row, 'title') || col(row, 'name') || col(row, 'product name'),
        url:          col(row, 'link') || col(row, 'url') || col(row, 'product url'),
        image:        col(row, 'image link') || col(row, 'image') || col(row, 'image url') || null,
        price:        parseFloat(col(row, 'price') || col(row, 'regular price') || 0),
        salePrice:    parseFloat(col(row, 'sale price') || col(row, 'special price') || 0) || null,
        store:        col(row, 'store') || col(row, 'merchant') || col(row, 'brand'),
        brand:        col(row, 'brand'),
        availability: col(row, 'availability') || col(row, 'stock') || 'In Stock',
      };
    }).filter(p => p.title && p.url);

    // ── Filter by search query ───────────────────────────────────────────────
    if (query) {
      products = products.filter(p =>
        p.title.toLowerCase().includes(query) ||
        (p.brand || '').toLowerCase().includes(query) ||
        (p.store || '').toLowerCase().includes(query)
      );
    }

    const total    = products.length;
    const paginated = products.slice(offset, offset + limit);

    return { statusCode: 200, headers, body: JSON.stringify({ products: paginated, total }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, products: [] }) };
  }
};
