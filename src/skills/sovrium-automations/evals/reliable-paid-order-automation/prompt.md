---
name: reliable-paid-order-automation
max_turns: 25
---

Write the Sovrium automation for ~/apps/shop: on orders, when status changes to paid, POST the order to https://api.example-books.com/v1/invoices, then write the returned invoice number back to the order's invoice_number field. It must never create two invoices for one order.
