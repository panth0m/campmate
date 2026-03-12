
# CampGearCompare Best Merged

This is the merged "best of both" version based on:
- the Cloudflare-ready 1000-product site
- the overwrite-ready automation structure

## What this version keeps
- Cloudflare Pages-ready structure (`wrangler.jsonc`)
- 1000 bundled local product images
- category pages, product pages, popular page, search page, guides
- affiliate-ready compare links
- optional eBay live route at `/api/ebay-search`
- GitHub Actions auto-build flow

## New merged additions
- `data/products_source.json` as your editable source file
- `scripts/build_products_json.py` to regenerate `data/products.json`
- `.github/workflows/update-products.yml` to auto-build on push

## Recommended editing flow
1. Edit `data/products_source.json`
2. Push to GitHub
3. GitHub Actions rebuilds `data/products.json`
4. Cloudflare Pages redeploys automatically

## Optional
If you do not want live eBay pricing, you can delete:
- `functions/api/ebay-search.js`

The site still works with store search links only.
