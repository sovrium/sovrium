---
type: llm
weight: 2
criteria: |
  The answer (1) does not create the issue through `gh issue create`, the GitHub API or an MCP issue tool, and says the user submits it through the form address in their browser because an issue created otherwise loses its type and labels, (2) gives a bug form address (`sovrium report`, `sovrium report --config app.yaml`, or an address with `template=bug.yml`), (3) names a Domain from the form's list (`tables` fits) and the Kind of bug `wrong-behaviour`, (4) writes an Agent brief with at least one numbered acceptance criterion in Given / When / Then form and a verification step a person can run, (5) proposes searching open and closed issues first, and (6) tells the user to tick the AI-assistance box.
---

The answer refuses to file through `gh` or the API and sends the user to the form, gives a bug form address, names a Domain and the Kind `wrong-behaviour`, writes numbered Given / When / Then acceptance criteria and a verification step, searches open and closed issues first, and asks the user to tick the AI-assistance box.
