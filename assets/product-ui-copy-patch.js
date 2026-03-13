(function () {
  function replaceTextDeep(root) {
    if (!root) return;

    const replacements = [
      { from: "Live eBay AU pricing", to: "Current eBay listings" },
      { from: "Uses /api/ebay-search. Set your eBay keys in Cloudflare environment variables.", to: "Showing current listings from eBay Australia sellers." },
      { from: "Open eBay search", to: "View on eBay" },
      { from: "Monetisation notes", to: "Compare notes" },
      { from: "Best flow: user lands on guide → opens compare page → clicks store button. Keep buttons clear and comparisons honest.", to: "Compare current offers, check recent pricing, and open the store listing that suits you best." },
      { from: "eBay live price unavailable", to: "Live eBay pricing unavailable right now" },
      { from: "Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in Cloudflare to enable live pricing.", to: "We could not load live eBay pricing at the moment. Please try again shortly." }
    ];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      let text = node.nodeValue;
      if (!text || !text.trim()) return;
      replacements.forEach((r) => {
        if (text.includes(r.from)) text = text.split(r.from).join(r.to);
      });
      node.nodeValue = text;
    });
  }

  function upgradeLabels() {
    const all = document.querySelectorAll("*");
    all.forEach((el) => {
      const t = (el.textContent || "").trim();
      if (t === "eBay live route") el.textContent = "Live marketplace";
      if (t === "Open eBay search") el.textContent = "View on eBay";
      if (t === "Monetisation notes") el.textContent = "Compare notes";
    });
  }

  function run() {
    replaceTextDeep(document.body);
    upgradeLabels();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  const obs = new MutationObserver(() => { run(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
