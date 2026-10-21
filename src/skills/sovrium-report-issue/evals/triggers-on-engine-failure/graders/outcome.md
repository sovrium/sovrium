---
type: llm
weight: 2
criteria: |
  The answer (1) first checks whether the configured database file is really a SQLite database (a wrong or damaged file is the likelier cause) before treating it as a Sovrium bug, (2) proposes searching existing issues for the signature before opening a new one, (3) uses `sovrium report --last-error` (or the printed address) rather than writing a fresh issue from scratch, (4) does not submit the issue itself but leaves the user to read and submit the form, and (5) keeps the absolute path `/home/ops/shop/data.db` out of what it proposes to paste.
---

The answer (1) first checks whether the configured database file is really a SQLite database before treating it as a Sovrium bug, (2) proposes searching existing issues for the signature before opening a new one, (3) uses `sovrium report --last-error` or the printed address, (4) leaves the user to read and submit the form, and (5) keeps the absolute path out of what it proposes to paste.
