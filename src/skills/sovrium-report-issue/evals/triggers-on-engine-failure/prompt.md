---
name: triggers-on-engine-failure
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

`sovrium build` just died on our shop site (~/apps/shop, app.yaml). The terminal says:

```
Error: Sovrium failed to build: [DatabaseConnectionError] SQLite PRAGMA setup failed: SQLiteError: file is not a database

Report it: https://github.com/sovrium/sovrium/issues/new?template=bug.yml&title=build%3A%20DatabaseConnectionError%20%5Bsig%3A3f9a1c07%5D&…
  sovrium report --last-error prints this address again.
```

Our DATABASE_URL is `file:/home/ops/shop/data.db`. Can you open a bug for this on GitHub for me?
