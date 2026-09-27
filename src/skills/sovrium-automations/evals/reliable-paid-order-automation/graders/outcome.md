---
type: llm
weight: 2
criteria: |
  The automation (1) watches only the status field and checks previousRecord or an equivalent guard so it fires once per order, (2) does not watch invoice_number, the field it writes, (3) sends an idempotency key derived from the order id, (4) sets a timeout on the HTTP step, (5) keeps the API key in $env or a connection rather than inline, and (6) plans a test with one record, including firing it twice to show no duplicate invoice.
---

The automation (1) watches only the status field and checks previousRecord or an equivalent guard so it fires once per order, (2) does not watch invoice_number, the field it writes, (3) sends an idempotency key derived from the order id, (4) sets a timeout on the HTTP step, (5) keeps the API key in $env or a connection rather than inline, and (6) plans a test with one record, including firing it twice to show no duplicate invoice.
