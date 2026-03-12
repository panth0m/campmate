# CampMate Australia – Cloudflare Pages version

This package is the **one-shot Cloudflare-ready version** with:

- 300 comparison-ready products
- 6 clearer category hero images
- 6 buying guides
- affiliate-ready store links
- eBay live search route at `/api/ebay-search`

## Upload to GitHub
Replace your current repo contents with the files in this folder.

## Cloudflare settings
Use these project settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: leave empty
- Root directory: repository root

## Environment variables
Add these in Cloudflare if you want live eBay results:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

## Important affiliate note
Store links are included as **clean search links** so the site works immediately.
To monetise fully, replace store URLs with your affiliate-tagged versions for:

- eBay Partner Network
- Amazon Associates AU
- Commission Factory / Impact links for AU retailers

## Files you can edit quickly
- `data/products.json` → product catalogue and store links
- `data/categories.json` → category cards and hero images
- `assets/images/categories/*.svg` → category visuals
- `assets/style.css` → styling
- `product.html` → compare table + conversion layout

## Remove from old repo
Delete old Netlify-only files like `netlify.toml`.
