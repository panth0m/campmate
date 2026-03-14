export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/api/ebay-search") {
      return handleEbaySearch(request, env);
    }

    if (url.pathname === "/api/google-search") {
      return handleGoogleSearch(request, env);
    }

    // sitemap.xml — must return correct Content-Type for Google Search Console
    if (url.pathname === '/sitemap.xml') {
      const resp = await env.ASSETS.fetch(request);
      return new Response(resp.body, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // robots.txt
    if (url.pathname === '/robots.txt') {
      const resp = await env.ASSETS.fetch(request);
      return new Response(resp.body, {
        status: resp.status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Static asset serving
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
}

async function handleEbaySearch(request, env) {
  const headers = corsHeaders();
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return new Response(JSON.stringify({
        error: "Missing query parameter: q",
        products: [],
        total: 0,
        query: q,
      }), { status: 400, headers });
    }

    const clientId = env.EBAY_CLIENT_ID;
    const clientSecret = env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        error: "eBay credentials missing",
        details: "Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in Cloudflare variables",
        products: [],
        total: 0,
        query: q,
      }), { status: 500, headers });
    }

    const basic = btoa(`${clientId}:${clientSecret}`);

    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(JSON.stringify({
        error: "Failed to get eBay token",
        details: tokenData,
        products: [],
        total: 0,
        query: q,
      }), { status: 500, headers });
    }

    const searchUrl = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("limit", "10");
    searchUrl.searchParams.set("filter", "deliveryCountry:AU");

    const ebayRes = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
      },
    });

    const ebayData = await ebayRes.json();

    if (!ebayRes.ok) {
      return new Response(JSON.stringify({
        error: "eBay response was not successful",
        details: ebayData,
        products: [],
        total: 0,
        query: q,
      }), { status: ebayRes.status, headers });
    }

    const products = Array.isArray(ebayData.itemSummaries)
      ? ebayData.itemSummaries.map((item) => ({
          title: item.title || "",
          price: item.price?.value || "",
          currency: item.price?.currency || "AUD",
          image: item.image?.imageUrl || "",
          link: item.itemWebUrl || "",
          condition: item.condition || "",
        }))
      : [];

    return new Response(JSON.stringify({
      products,
      total: products.length,
      query: q,
    }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Unexpected eBay server error",
      details: error instanceof Error ? error.message : String(error),
      products: [],
      total: 0,
    }), { status: 500, headers });
  }
}

async function handleGoogleSearch(request, env) {
  const headers = corsHeaders();
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const numParam = parseInt(url.searchParams.get("num") || "5", 10);
    const num = Math.min(Math.max(numParam, 1), 10);

    if (!q) {
      return new Response(JSON.stringify({
        error: "Missing query parameter: q",
        items: [],
        total: 0,
        query: q,
      }), { status: 400, headers });
    }

    const apiKey = env.GOOGLE_API_KEY;
    const cseId = env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      return new Response(JSON.stringify({
        error: "Google API credentials are missing",
        details: "Add GOOGLE_API_KEY and GOOGLE_CSE_ID in Cloudflare variables",
        items: [],
        total: 0,
        query: q,
      }), { status: 500, headers });
    }

    const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("cx", cseId);
    endpoint.searchParams.set("q", q);
    endpoint.searchParams.set("num", String(num));

    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: "Google search request failed",
        details: data,
        items: [],
        total: 0,
        query: q,
      }), { status: response.status, headers });
    }

    const items = Array.isArray(data.items)
      ? data.items.map((item) => {
          const pagemap = item.pagemap || {};
          const cseImages = Array.isArray(pagemap.cse_image) ? pagemap.cse_image : [];
          const metatags = Array.isArray(pagemap.metatags) ? pagemap.metatags : [];

          const image =
            cseImages[0]?.src ||
            metatags[0]?.["og:image"] ||
            metatags[0]?.["twitter:image"] ||
            "";

          return {
            title: item.title || "",
            link: item.link || "",
            displayLink: item.displayLink || "",
            snippet: item.snippet || "",
            image,
          };
        })
      : [];

    return new Response(JSON.stringify({
      items,
      total: items.length,
      query: q,
    }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Unexpected Google server error",
      details: error instanceof Error ? error.message : String(error),
      items: [],
      total: 0,
    }), { status: 500, headers });
  }
}
