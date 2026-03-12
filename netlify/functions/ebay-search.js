exports.handler = async function (event) {
  try {
    const query = (event.queryStringParameters?.q || 'camping gear').trim();
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing eBay environment variables' }),
      };
    }

    const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get eBay token', details: tokenData }),
      };
    }

    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=24&filter=priceCurrency:AUD`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU',
      },
    });

    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      return {
        statusCode: searchRes.status,
        body: JSON.stringify({ error: 'eBay response was not successful', details: searchData }),
      };
    }

    const items = (searchData.itemSummaries || []).map((item) => ({
      id: item.itemId || item.itemWebUrl,
      title: item.title || '',
      url: item.itemWebUrl || '#',
      image: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '',
      price: item.price?.value || '',
      currency: item.price?.currency || 'AUD',
      shipping: item.shippingOptions?.[0]?.shippingCost?.value || '0',
      freeShipping: !!item.shippingOptions?.[0]?.freeShipping,
      condition: item.condition || '',
      feedbackScore: item.seller?.feedbackScore || 0,
      feedbackPct: item.seller?.feedbackPercentage || 0,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        items,
        total: Number(searchData.total || items.length),
        query,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected ebay-search error', details: error.message }),
    };
  }
};
