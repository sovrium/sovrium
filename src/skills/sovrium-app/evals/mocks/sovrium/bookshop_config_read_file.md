---
expect:
  path: app.yaml
---

{"path": "app.yaml", "sha256": "9b2e4c1a7d3f5e8b0c6a2d4f1e3b5c7a9d0e2f4a6b8c1d3e5f7a9b0c2d4e6f8a", "content": "name: bookshop\ntables:\n- {id: 1, name: books, fields: [{id: 1, name: title, type: single-line-text, required: true}, {id: 2, name: author, type: single-line-text}, {id: 3, name: price, type: currency, currency: EUR}]}\npages:\n- {name: home, path: /, components: [{type: text, element: h1, content: Bookshop}]}\n"}
