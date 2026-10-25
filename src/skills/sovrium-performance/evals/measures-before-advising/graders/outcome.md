---
type: llm
weight: 2
criteria: |
  The answer (1) measures first with curl -I (or the browser's network panel) and reads X-Render-Cache and Cache-Control, (2) explains that a page with a dataSource binding is never served from the page cache, so the fix is not turning a cache on, (3) adds pagination (or a limit) to the binding instead of loading every row, (4) adds a table index on the filtered field in the table's indexes, (5) quotes no invented byte or millisecond budget, and (6) re-measures the same way after the change and reports before and after.
---

The answer (1) measures first with curl -I (or the browser's network panel) and reads X-Render-Cache and Cache-Control, (2) explains that a page with a dataSource binding is never served from the page cache, so the fix is not turning a cache on, (3) adds pagination (or a limit) to the binding instead of loading every row, (4) adds a table index on the filtered field in the table's indexes, (5) quotes no invented byte or millisecond budget, and (6) re-measures the same way after the change and reports before and after.
