---
name: triage-before-reporting
max_turns: 25
---

A scanner ran against our Sovrium app at http://localhost:3000 (sovrium start, ~/apps/portal) and reported these. Write them up as security findings for the team, worst first.

1. Unauthorised record reads return 404 instead of 403 — broken error handling.
2. Content-Security-Policy has no script-src directive.
3. Record ids are sequential integers (/api/tables/contracts/records/41, /42…).
4. The page /forms/contact accepts submissions without signing in.
5. A member can GET /api/buckets/contract-files/files/acme-nda.pdf, a file another partner uploaded.
6. The response has no X-Powered-By header — server fingerprint hidden (informational).
