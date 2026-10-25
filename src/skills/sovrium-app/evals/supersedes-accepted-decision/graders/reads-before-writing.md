---
type: regex
weight: 1
pattern: 'workshop_config_read_file'
match: contains
target: mock_calls
---

The agent reads app.yaml, and with it the decision register, before it writes anything.
