---
type: llm
weight: 2
criteria: |
  The agent changes only the field's label, keeps the field id unchanged, writes the whole file with expectedSha and validates. It adds NO entry under decisions and changes no existing record, because a label is reversible in a minute and is not worth a decision record; it does not ask the user to accept a record for this change.
---

The agent renames the label without touching the field id, writes the whole file with expectedSha, validates, and adds no decision record: a label is not worth one.
