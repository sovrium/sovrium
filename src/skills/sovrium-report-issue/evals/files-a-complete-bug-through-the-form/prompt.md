---
name: files-a-complete-bug-through-the-form
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

On Sovrium 0.45.0 (~/apps/bakery, app.yaml validates), sorting the `orders` grid view by `pickup_on` puts every order with an empty date first, even with `direction: desc`. The manual says empty values sort last in both directions. It happens every time, on SQLite and on PostgreSQL. I have the `gh` CLI logged in — just file the issue on sovrium/sovrium for me.
