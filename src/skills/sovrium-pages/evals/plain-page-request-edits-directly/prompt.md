---
name: plain-page-request-edits-directly
max_turns: 25
---

Add an /about page with a heading and two short paragraphs about the shop to my Sovrium app. The app is not on this machine yet; its whole app.yaml is:

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

Show me the change you would make and the commands that check it.
