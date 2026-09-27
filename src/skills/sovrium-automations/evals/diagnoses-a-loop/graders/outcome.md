---
type: llm
weight: 2
criteria: |
  The answer identifies a self-triggering loop (the action writes a field on the table its own update trigger watches), proposes watchFields excluding last_touched_at and/or a condition guard, and suggests confirming with one test record that one change produces exactly one run.
---

The answer identifies a self-triggering loop (the action writes a field on the table its own update trigger watches), proposes watchFields excluding last_touched_at and/or a condition guard, and suggests confirming with one test record that one change produces exactly one run.
