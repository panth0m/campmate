
# CampMate Australia — Cloudflare Pages version

This is a Cloudflare-ready version of your camping gear compare site.

## What is included

- Static Pages site
- Category pages
- Product pages
- Guide pages
- Live eBay AU pricing through `functions/api/ebay-search.js`
- Clean relative paths so CSS/JS load correctly on Cloudflare Pages

## File structure

```text
.
├─ index.html
├─ categories.html
├─ category.html
├─ popular.html
├─ product.html
├─ search.html
├─ guides.html
├─ guides/
├─ assets/
├─ data/
└─ functions/api/ebay-search.js
```

## Deploy on Cloudflare Pages

### 1. Push this folder to GitHub
Upload all files to your GitHub repo.

### 2. In Cloudflare Pages
Use these settings:

- **Framework preset:** None
- **Build command:** leave empty
- **Build output directory:** `/`

### 3. Add environment variables in Cloudflare
Go to your project → Settings → Environment variables

Add:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_ENV` = `production`

Use `sandbox` only if you are testing with sandbox credentials.

## Important

This site uses **relative paths** like:

- `assets/style.css`
- `assets/common.js`
- `data/products.json`

So it should load CSS/JS correctly on Cloudflare Pages.

## eBay live API route

The product page fetches:

```text
/api/ebay-search?q=product name
```

Cloudflare Pages Functions will handle that automatically from:

```text
/functions/api/ebay-search.js
```

## Notes

- Product images are using remote image URLs for convenience.
- If you want local images later, replace image URLs in `data/products.json`.
- If eBay credentials are missing, the site still works, but live eBay pricing will show as unavailable.
