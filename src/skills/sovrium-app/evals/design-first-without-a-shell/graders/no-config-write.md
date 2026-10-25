---
type: regex
weight: 1
pattern: 'bookshop_config_write_file'
match: not_contains
target: mock_calls
---

The agent writes no config file before the person has chosen how to proceed.
