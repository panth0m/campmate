// Google Custom Search API — runs server-side
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const params = event.queryStringParameters || {};
    const query  = params.q || 'camping gear australia';

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CSE_ID  = process.env.GOOGLE_CSE_ID;

    // ── No Google keys yet → return empty gracefully ────────────────────────
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      return { statusCode: 200, headers, body: JSON.stringify({ items: [], note: 'Google API not configured yet' }) };
    }

    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.set('key', GOOGLE_API_KEY);
    searchUrl.searchParams.set('cx',  GOOGLE_CSE_ID);
    searchUrl.searchParams.set('q',   `${query} site:bcf.com.au OR site:anaconda.com.au OR site:snowys.com.au OR site:tentworld.com.au OR site:paddypallin.com.au`);
    searchUrl.searchParams.set('num', '10');

    const res = await fetch(searchUrl.toString());
    if (!res.ok) throw new Error(`Google API error: ${res.status}`);

    const data  = await res.json();
    const items = (data.items || []).map(item => ({
      title: item.title,
      url:   item.link,
      store: item.displayLink,
      image: item.pagemap?.cse_image?.[0]?.src || null,
      price: item.pagemap?.offer?.[0]?.price || item.pagemap?.product?.[0]?.offers || null,
      rating: item.pagemap?.aggregaterating?.[0]?.ratingvalue || null,
      reviews: item.pagemap?.aggregaterating?.[0]?.reviewcount || null,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ items }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, items: [] }) };
  }
};
