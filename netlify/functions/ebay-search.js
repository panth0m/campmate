// eBay Browse API — runs on Netlify server (has access to env vars, no CORS issues)
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const params   = event.queryStringParameters || {};
    const query    = params.q     || 'camping tent';
    const sort     = params.sort  || 'BestMatch';
    const limit    = parseInt(params.limit || '12', 10);

    const CLIENT_ID     = process.env.EBAY_CLIENT_ID;
    const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'eBay credentials not set in Netlify environment variables.' }) };
    }

    // ── 1. Get OAuth token ──────────────────────────────────────────────────
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'eBay token failed', detail: txt }) };
    }

    const { access_token } = await tokenRes.json();

    // ── 2. Sort mapping ─────────────────────────────────────────────────────
    const sortMap = {
      BestMatch:    'BEST_MATCH',
      PricePlusShippingLowest: 'PRICE',
      EndTimeSoonest: 'ENDING_SOONEST',
    };
    const ebaySort = sortMap[sort] || 'BEST_MATCH';

    // ── 3. Browse API search (EBAY_AU = marketplace ID 15) ──────────────────
    const searchUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('sort', ebaySort);
    searchUrl.searchParams.set('limit', String(limit));
    searchUrl.searchParams.set('filter', 'deliveryCountry:AU,currency:AUD');

    const searchRes = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DAU',
      },
    });

    if (!searchRes.ok) {
      const txt = await searchRes.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'eBay search failed', detail: txt }) };
    }

    const data  = await searchRes.json();
    const items = (data.itemSummaries || []).map(item => ({
      id:           item.itemId,
      title:        item.title,
      url:          item.itemWebUrl,
      image:        item.image?.imageUrl || null,
      price:        parseFloat(item.price?.value || 0),
      currency:     item.price?.currency || 'AUD',
      shipping:     parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || 0),
      freeShipping: item.shippingOptions?.[0]?.shippingCostType === 'FREE' || parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || 1) === 0,
      condition:    item.condition || 'New',
      feedbackScore: item.seller?.feedbackScore || 0,
      feedbackPct:  item.seller?.feedbackPercentage || 0,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ items, total: data.total || items.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
