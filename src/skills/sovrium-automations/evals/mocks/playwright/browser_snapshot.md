---
expect: 'called after browser_navigate to http://localhost:3000/_admin (the run history of an automation)'
---

- main:
  - heading "Automation runs" [level=1] [ref=e4]
  - table "Runs" [ref=e6]:
    - row: "Automation Status Started Duration"
    - row: "invoice-on-paid completed 10:42:07 812 ms"
    - row: "invoice-on-paid completed 10:41:55 790 ms"
