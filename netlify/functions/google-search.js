exports.handler = async function (event) {
  try {
    const query = (event.queryStringParameters?.q || "camping gear").trim();

    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cx) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing Google search environment variables",
        }),
      };
    }

    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&cx=${encodeURIComponent(cx)}` +
      `&q=${encodeURIComponent(query)}` +
      `&num=10`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Google search request failed",
          details: data,
        }),
      };
    }

    const items = (data.items || []).map((item) => ({
      id: item.cacheId || item.link,
      title: item.title || "",
      url: item.link || "",
      snippet: item.snippet || "",
      image:
        item.pagemap?.cse_image?.[0]?.src ||
        item.pagemap?.cse_thumbnail?.[0]?.src ||
        "",
      source: (() => {
        try {
          return new URL(item.link).hostname.replace("www.", "");
        } catch {
          return "web";
        }
      })(),
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        items,
        total: Number(data.searchInformation?.totalResults || 0),
        query,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Google search failed",
        details: error.message,
      }),
    };
  }
};
