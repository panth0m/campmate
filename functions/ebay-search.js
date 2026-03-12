
const tokenCache = { value: null, expiresAt: 0 };

async function getAccessToken(env) {
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  const clientId = env.EBAY_CLIENT_ID;
  const clientSecret = env.EBAY_CLIENT_SECRET;
  const envName = (env.EBAY_ENV || "production").toLowerCase();

  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET");
  }

  const authBase =
    envName === "sandbox"
      ? "https://api.sandbox.ebay.com"
      : "https://api.ebay.com";

  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${authBase}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to get eBay token");
  }

  tokenCache.value = data.access_token;
  tokenCache.expiresAt = Date.now() + (data.expires_in || 7200) * 1000;
  return tokenCache.value;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q) {
    return Response.json({ error: "Missing q parameter", products: [], total: 0 }, { status: 400 });
  }

  try {
    const token = await getAccessToken(env);
    const envName = (env.EBAY_ENV || "production").toLowerCase();
    const browseBase =
      envName === "sandbox"
        ? "https://api.sandbox.ebay.com"
        : "https://api.ebay.com";

    const endpoint = `${browseBase}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=12&filter=buyingOptions:%7BFIXED_PRICE%7D`;
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
        Accept: "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json(
        {
          error: "eBay response was not successful",
          details: data,
          products: [],
          total: 0,
          query: q,
        },
        { status: res.status }
      );
    }

    const items = (data.itemSummaries || []).map((item) => ({
      title: item.title || "",
      price: item.price ? `${item.price.value} ${item.price.currency}` : "",
      image: item.image?.imageUrl || "",
      condition: item.condition || "",
      shipping: item.shippingOptions?.[0]?.shippingCost
        ? `${item.shippingOptions[0].shippingCost.value} ${item.shippingOptions[0].shippingCost.currency}`
        : "",
      url: item.itemWebUrl || "",
    }));

    return Response.json({
      products: items,
      total: data.total || items.length,
      query: q,
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Unexpected error",
        products: [],
        total: 0,
        query: q,
      },
      { status: 500 }
    );
  }
}
