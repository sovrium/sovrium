---
type: llm
weight: 2
criteria: |
  The agent reads the file with crm_config_read_file before writing, sends the whole file with expectedSha to crm_config_write_file, keeps the field id unchanged, and validates afterwards with crm_config_validate.
---

The agent reads the file with crm_config_read_file before writing, sends the whole file with expectedSha to crm_config_write_file, keeps the field id unchanged, and validates afterwards with crm_config_validate.
