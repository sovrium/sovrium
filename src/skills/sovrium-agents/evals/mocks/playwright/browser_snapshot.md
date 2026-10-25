---
# Not an argument guard: called after browser_navigate to http://localhost:3000/help.
---

- main:
  - heading "Help" [level=1] [ref=e2]
  - region "Chat":
    - log:
      - article "assistant": "Hello — ask me about your tickets."
    - textbox "Ask a question…" [ref=e6]
    - button "Send" [ref=e7]
