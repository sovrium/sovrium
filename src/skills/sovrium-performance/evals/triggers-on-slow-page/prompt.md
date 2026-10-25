---
name: triggers-on-slow-page
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Our shop runs on Sovrium (~/apps/shop, `app.yaml` with `config/pages/*.yaml` and `config/tables/*.yaml`). The home page feels heavy and the /products page takes ages to load. Make it faster.
