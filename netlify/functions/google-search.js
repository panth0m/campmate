exports.handler = async function(event) {
  try {
    const query = event.queryStringParameters.q || "camping gear";

    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    const data = await response.json();

    const items = (data.items || []).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      image: item.pagemap?.cse_image?.[0]?.src || ""
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        items,
        total: data.searchInformation?.totalResults || 0,
        query
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Google search failed",
        details: error.message
      })
    };
  }
};
