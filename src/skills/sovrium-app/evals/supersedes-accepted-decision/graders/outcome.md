---
type: llm
weight: 3
criteria: |
  The agent notices that the accepted record ADR-003 ("Quote lines in their own table", touches "tables › quote_lines") covers the requested change, and does not silently contradict it. It either asks Léa whether to supersede ADR-003 before editing, or writes a superseding record: a NEW entry under decisions with supersedes: ADR-003, status: proposed, deciders naming Léa (never the agent or "AI"), a YYYY-MM-DD date and touches naming the tables, while ADR-003 is set to status: superseded with supersededBy pointing at the new id. ADR-003 is neither deleted nor rewritten in place, the new record is not marked accepted without Léa's confirmation, and the agent validates after editing the register.
---

The agent notices that the accepted record ADR-003 covers the requested change and does not silently contradict it: it asks first, or writes a proposed superseding record naming Léa as decider and marks ADR-003 superseded with both lineage ends authored, never deleting or rewriting it, never marking the new record accepted unasked, and validating afterwards.
