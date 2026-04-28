# Content Source

This project keeps storefront content in JSON so the catalog and site copy can be updated without editing React components.

Files:
- `catalog.json`: products and category definitions
- `site.json`: site identity, homepage copy, and legal page content

Notes:
- Product `slug` values are route keys and should stay stable.
- Image paths must point to files already available in `public/`.
- The checkout flow uses product names, prices, excerpts, and sizes from `catalog.json`.
