---
# Not an argument guard: called after browser_navigate to http://localhost:3000/products (or a page under it).
---

- banner:
  - link "Atelier Lumen" [ref=e2]
  - navigation "Main":
    - link "Lamps" [ref=e4]
    - link "Shades" [ref=e5]
- main:
  - heading "All products" [level=1] [ref=e7]
  - table "Products" [ref=e8]:
    - row "Name Category Price"
    - row "Opaline pendant Lighting 189.00 €"
    - row "Linen drum shade Shades 64.00 €"
- contentinfo:
  - text: "Atelier Lumen, Lyon"
