---
expect:
  path: app.yaml
---

{"path": "app.yaml", "sha256": "4f1c2a9e0b7d3c58a6e2f19d0c4b7a3e5d8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b", "content": "name: workshop\ndecisions:\n- {id: ADR-003, title: Quote lines in their own table, status: accepted, date: '2026-03-12', deciders: [Léa Fontaine], touches: [tables › quote_lines, tables › quotes], context: A quote has between one and forty lines and the monthly report sums lines across quotes., decision: Lines live in a quote_lines table with a relation to quotes and not in a JSON field., consequences: The report is a plain rollup. Editing a quote touches two tables.}\ntables:\n- {id: 1, name: quotes, fields: [{id: 1, name: number, type: single-line-text, required: true}, {id: 2, name: customer_name, label: Customer name, type: single-line-text}, {id: 3, name: lines, type: relationship, relatedTable: quote_lines, relationType: one-to-many}]}\n- {id: 2, name: quote_lines, fields: [{id: 1, name: description, type: single-line-text}, {id: 2, name: amount, type: currency, currency: EUR}]}\n"}
