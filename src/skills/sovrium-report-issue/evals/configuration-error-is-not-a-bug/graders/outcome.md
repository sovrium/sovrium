---
type: llm
weight: 2
criteria: |
  The answer finds that validation refuses the unknown property `lable` (a typo for `label`), tells the user this is a configuration error rather than a Sovrium bug, proposes the one-word fix and re-validating, and does not open, draft or prefill a bug report.
---

The answer finds the `lable` typo through validation, says it is a configuration error, proposes the fix and re-validating, and does not file a bug.
