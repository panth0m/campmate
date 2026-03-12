export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const numParam = parseInt(url.searchParams.get("num") || "5", 10);
    const num = Math.min(Math.max(numParam, 1), 10);

    if (!q) {
      return new Response(
        JSON.stringify({
          error: "Missing query parameter: q",
          items: [],
          total: 0,
          query: q,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = env.GOOGLE_API_KEY;
    const cseId = env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      return new Response(
        JSON.stringify({
          error: "Google API credentials are missing",
          details: "Add GOOGLE_API_KEY and GOOGLE_CSE_ID in Cloudflare Variables",
          items: [],
          total: 0,
          query: q,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("cx", cseId);
    endpoint.searchParams.set("q", q);
    endpoint.searchParams.set("num", String(num));

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Google search request failed",
          details: data,
          items: [],
          total: 0,
          query: q,
        }),
        { status: response.status, headers: corsHeaders }
      );
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

    return new Response(
      JSON.stringify({
        items,
        total: items.length,
        query: q,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected server error",
        details: error instanceof Error ? error.message : String(error),
        items: [],
        total: 0,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
