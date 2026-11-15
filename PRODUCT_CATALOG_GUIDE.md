# Nkem Global Supercenter - Product Catalog & Upload Integrity Rules

## 1. Golden Rules for Products & Uploads
Whenever any product is added to Supabase (`nkem_products`), either manually via the Admin Panel (`admin.html`) or via an automated script, the following rules MUST be strictly enforced:

1. **Strict Image Compression (≤ 95 KB per image):**
   - NEVER save raw uncompressed camera photos or large Base64 strings (> 95 KB) into Supabase.
   - Large images bloat the REST query payload from ~300 KB to > 2 MB, which causes mobile networks to time out and drops visitor browsers into stale offline cache.
   - Use `assets/products/<name>.jpg` whenever possible, or ensure client-side Base64 compression via `window.ImageCompressor` is ≤ 90 KB.

2. **Always Provide a Valid `category_id`:**
   - Every product must have an exact `category_id` matching an active record in `nkem_categories` (e.g., `cat-handbags`, `cat-clothes`, `cat-vehicles`, `cat-inverters`, `cat-tricycles`, `cat-beauty`).
   - If omitted, default to `cat-clothes`.

3. **Promote New Products to Storefront:**
   - New products must be given `sort_order: 1` and a fresh `created_at` timestamp so they immediately show at the top of the storefront and at the top of their category as New Arrivals.

4. **Cache Invalidation & Fresh Sync:**
   - When updating catalog architecture, bump `CATALOG_VERSION` in `js/supabase-config.js` and script query strings (`?v=...`) in `index.html` and `admin.html`.
   - The system enforces a 12-hour Cache TTL to automatically purge stale client storage.

---

## 2. Emergency Recovery Prompt (For Future AI Assistants & Developers)

If products are confirmed in Supabase but the storefront says "No matching products found":

```markdown
### SYSTEM TASK: Fix Products Not Showing / "No Matching Products Found" on Storefront

**Context & Symptom:**
Products exist in the Supabase database (`nkem_products`), but the live storefront (`nkemmarket.com`) shows "No matching products found" when opening the shop or clicking certain categories (e.g. Hand Bags, Solar, Vehicles).

Please perform the following diagnostic and recovery steps immediately:

1. **Check for Oversized Images in Supabase (Payload Timeout Bug):**
   - Inspect `nkem_products` for any records where images are uncompressed or contain raw `data:image` Base64 strings.
   - If images are over 100 KB, the Supabase REST query (`limit=1000`) will exceed 1–2 MB, causing mobile network requests to time out (fallback to old browser cache).
   - **Fix:** Extract and compress any large images down to WebP/JPEG files ≤ 90 KB, save them in `assets/products/`, and update their records in Supabase.

2. **Clear Stale Client Cache (Cache Invalidation):**
   - When a fetch times out, the browser falls back to stale `localStorage` (`nkem_local_products`), which may only contain an older batch of products.
   - **Fix:**
     - In `js/supabase-config.js`, bump the `CATALOG_VERSION` (e.g. `v2026_update`) so client devices automatically purge old local storage on startup.
     - Verify the 12-hour Cache TTL so client caches never stay stale indefinitely.
     - Ensure full catalog queries replace `nkem_local_products` directly with authoritative cloud data rather than appending.

3. **Verify Category Slug & ID Matching:**
   - Ensure `state.selectedCategory` in `js/app.js` correctly maps between human-readable category names (e.g., "Hand Bags & Luggage") and database slugs/IDs (e.g., `cat-handbags`).
   - Ensure the defensive fallback in `applyFiltersAndSort()` is active: if an in-memory category filter produces 0 items, display a loading spinner and query Supabase directly for `categoryId: targetId`.

4. **Check Sort Order (Prevent Burying New Products):**
   - Check the `sort_order` of newly created products. If new products are assigned high numbers (e.g., 280+), they will be buried at the end of pagination (Page 18) and appear missing on the front page.
   - **Fix:** Ensure new products have `sort_order: 1` and sort order defaults to `sort_order ASC, created_at DESC` so new arrivals always appear at the top.

5. **Verify Git Deployment & Version Bump:**
   - Check `git status` to ensure all modified JS/CSS files and newly compressed product image assets are committed and pushed to `main`.
   - In `index.html` and `admin.html`, bump the script query string version (e.g. `app.js?v=...`) to force client browsers to download the latest code instead of using browser-cached scripts.
```
