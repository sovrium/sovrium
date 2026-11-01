---
type: llm
weight: 2
criteria: |
  The answer (1) treats this as a feature suggestion, not a bug, (2) uses the engine primitive feature form, (3) names a Domain from the form's list, (4) explains in the "why existing pieces are not enough" field which existing pieces were considered and where they stop, (5) drafts numbered Given / When / Then acceptance criteria, and (6) leaves the user to submit the form in their browser, without creating the issue through `gh`, the API or an MCP tool.
---

The answer treats it as a feature, uses the engine primitive form, names a Domain, says why existing pieces cannot be composed, drafts numbered Given / When / Then criteria, and leaves the submission to the user in the browser.
