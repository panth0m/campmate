
exports.handler = async function (event) {
  try {
    const rawQuery = (event.queryStringParameters?.q || "camping tent").trim();
    const queryCandidates = [
      rawQuery,
      rawQuery.replace(/\b(4P|6P|2P)\b/gi, '').replace(/\s+/g,' ').trim(),
      rawQuery.replace(/\b(tent|stove|chair|cooler|lantern)\b/gi, '').replace(/\s+/g,' ').trim()
    ].filter(Boolean);
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { statusCode: 500, body: JSON.stringify({ error: "Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET" }) };
    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) return { statusCode: 500, body: JSON.stringify({ error: "Failed to get eBay token", details: tokenData }) };
    let found = [];
    for (const q of queryCandidates) {
      const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=18&filter=buyingOptions:{FIXED_PRICE}`;
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${tokenData.access_token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU" } });
      const searchData = await searchRes.json();
      const list = searchData.itemSummaries || [];
      if (list.length) { found = list; break; }
    }
    const items = found.map((it) => ({
      id: it.itemId || "", title: it.title || "", url: it.itemWebUrl || "#", image: it.image?.imageUrl || "",
      price: it.price?.value || "", currency: it.price?.currency || "AUD",
      shipping: it.shippingOptions?.[0]?.shippingCost?.value || "0",
      freeShipping: !!it.shippingOptions?.some((x) => x.shippingCost?.value === "0"),
      condition: it.condition || "", feedbackPct: it.seller?.feedbackPercentage || 0, feedbackScore: it.seller?.feedbackScore || 0
    }));
    return { statusCode: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ items, total: items.length, query: rawQuery }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "eBay request failed", details: error.message }) };
  }
};
