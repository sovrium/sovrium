---
name: triggers-on-design-first
max_turns: 25
---

Design first: my Sovrium app needs a /books page listing every book with its author and price. Show me before you build it. The app is not on this machine yet; its whole app.yaml is:

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
