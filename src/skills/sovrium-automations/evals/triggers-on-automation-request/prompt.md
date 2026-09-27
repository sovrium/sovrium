---
name: triggers-on-automation-request
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

In my Sovrium app (~/apps/shop/app.yaml) I want an automation: when an order's status becomes 'paid', create the invoice in our accounting API (POST https://api.example-books.com/v1/invoices) and email the customer. The API key is in my password manager.
