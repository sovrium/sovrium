---
name: design-first-declares-table-in-config
max_turns: 25
---

Mock it up first: I want a /reviews page where readers leave a rating and a comment on a book. There is no reviews table yet. The app is not on this machine yet; its whole app.yaml is:

    name: bookshop
    tables:
      - id: 1
        name: books
        fields:
          - { id: 1, name: title, type: single-line-text, required: true }
          - { id: 2, name: author, type: single-line-text }
          - { id: 3, name: price, type: currency, currency: EUR }
    pages:
      - { name: home, path: /, components: [{ type: text, element: h1, content: Bookshop }] }

Before you change anything, tell me, in order, the steps and the exact commands you will run.
