# Zambux Admin (web)

A plain static web page (no build step) for running the business from a computer: overview numbers, the businesses list
with search and filters, the verification queue with a 48 hour clock, and projected revenue. Austin only for now.

## What it needs
- Migration `supabase/migrations/033_admin_dashboard.sql` run in Supabase. It adds `admin_overview()`, `admin_list_businesses()`
  and the `plan_prices` table. Without it the page signs in but cannot load data.
- An admin account (a row in the `admins` table). Anyone else who signs in is turned away, and the database refuses them anyway.

## Try the layout without touching real data
Serve this folder and open `index.html?demo=1`. Sample mode uses made-up businesses and saves nothing.

## Where it will live
Placeholder until the real address is chosen. Any static host works (GitHub Pages, Cloudflare Pages, Netlify). The page only
holds the public Supabase key (in `config.js`), which is safe to publish: the database decides what each person may see.
Keep the page out of search results (it already says `noindex`). Never put the service_role key in this folder.

## Files
- `index.html`, `styles.css`, `app.js`, `config.js`
