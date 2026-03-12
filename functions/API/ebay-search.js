export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) {
    return Response.json({ error: 'Missing query', products: [], total: 0, query: q }, { status: 400 });
  }

  const clientId = env.EBAY_CLIENT_ID;
  const clientSecret = env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({
      error: 'Missing eBay credentials',
      products: [],
      total: 0,
      query: q,
    }, { status: 500 });
  }

  try {
    const basic = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basic}`,
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return Response.json({ error: 'Failed to get eBay token', details: tokenData, products: [], total: 0, query: q }, { status: 500 });
    }

    const browseUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    browseUrl.searchParams.set('q', q);
    browseUrl.searchParams.set('limit', '8');
    browseUrl.searchParams.set('filter', 'deliveryCountry:AU');
    const browseRes = await fetch(browseUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU',
      },
    });
    const browseData = await browseRes.json();
    if (!browseRes.ok) {
      return Response.json({ error: 'eBay response was not successful', ack: '', details: browseData, products: [], total: 0, query: q }, { status: 500 });
    }

    const items = (browseData.itemSummaries || []).map((item) => ({
      title: item.title,
      price: item.price ? `${item.price.value} ${item.price.currency}` : null,
      image: item.image?.imageUrl || null,
      url: item.itemWebUrl || null,
      condition: item.condition || null,
    }));

    return Response.json({ products: items, total: browseData.total || items.length, query: q });
  } catch (error) {
    return Response.json({ error: 'Unexpected server error', details: String(error), products: [], total: 0, query: q }, { status: 500 });
  }
}
