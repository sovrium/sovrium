---
expect: 'called after browser_navigate to http://localhost:3000/ (or a page under it)'
---

- banner:
  - link "Bookshop" [ref=e2]
  - navigation "Main":
    - link "Books" [ref=e4]
- main:
  - heading "Featured books" [level=1] [ref=e6]
  - list [ref=e7]:
    - listitem: "The Left Hand of Darkness — Ursula K. Le Guin"
    - listitem: "Kindred — Octavia E. Butler"
    - listitem: "Piranesi — Susanna Clarke"
- contentinfo:
  - text: "© Bookshop"
