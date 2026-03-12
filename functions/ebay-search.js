
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
async function getAccessToken(env) {
  const clientId = env.EBAY_CLIENT_ID;
  const clientSecret = env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing eBay environment variables');
  const auth = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: EBAY_SCOPE });
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Failed to get eBay token');
  return tokenData.access_token;
}
export async function onRequestGet(context) {
  try {
    const q = context.request.url ? new URL(context.request.url).searchParams.get('q')?.trim() : '';
    if (!q) return Response.json({ error: 'Missing q parameter', products: [], total: 0 }, { status: 400 });
    const accessToken = await getAccessToken(context.env);
    const endpoint = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=8&filter=buyingOptions:%7BFIXED_PRICE%7D`;
    const apiRes = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU'
      }
    });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      return Response.json({ error: 'eBay response was not successful', details: data, products: [], total: 0, query: q }, { status: 500 });
    }
    const products = (data.itemSummaries || []).map(item => ({
      title: item.title,
      price: item.price ? `${item.price.value} ${item.price.currency}` : '',
      url: item.itemWebUrl || '',
      image: item.image?.imageUrl || '',
      condition: item.condition || ''
    }));
    return Response.json({ products, total: data.total || products.length, query: q });
  } catch (error) {
    return Response.json({ error: error.message || 'Unknown error', products: [], total: 0 }, { status: 500 });
  }
}
