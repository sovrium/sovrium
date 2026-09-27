# Sources

Each entry: title — author or organisation — URL — date — licence (where known). "Lifted" is a paraphrase; nothing is copied verbatim. URLs were fetched or returned by search on 2026-09-24.

1. **Handle errors gracefully** — n8n — https://docs.n8n.io/build/flow-logic/handle-errors-gracefully — date not recorded.
   Lifted: a central error workflow instead of per-workflow notification steps.
2. **Executions** — n8n — https://docs.n8n.io/workflows/executions/ — date not recorded.
   Lifted: read the execution history as the verification step.
3. **Workflow templates** — n8n — https://docs.n8n.io/build/ways-of-building-workflows/use-templates — date not recorded.
   Lifted: start from a template, then replace every placeholder.
4. **Autoreplay** — Zapier — https://help.zapier.com/hc/en-us/articles/8496241726989 — date not recorded. _The retry ladder was read from a search excerpt, unverified by fetch._
   Lifted: automatic replay of failed steps with growing delays.
5. **Custom error handling** — Zapier — https://help.zapier.com/hc/en-us/articles/22495436062605-Set-up-custom-error-handling — date not recorded.
   Lifted: decide per step what a failure means for the rest of the run.
6. **Code by Zapier** — Zapier — https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier — date not recorded.
   Lifted: typed input map in, small object out, no secrets in code.
7. **Zap templates** — Zapier — https://docs.zapier.com/platform/publish/zap-templates — date not recorded.
   Lifted: templates as starting points with placeholders.
8. **Error handlers** — Make — https://help.make.com/error-handlers — date not recorded.
   Lifted: the per-step directives (ignore, fallback, park for later, stop).
9. **Run a script action**, **Secrets**, **Troubleshooting automations** — Airtable — https://support.airtable.com/articles/6328053615-airtable-automation-action-run-a-script, https://airtable.com/developers/scripting/api/secrets, https://support.airtable.com/articles/6756755850-troubleshooting-airtable-automations — date not recorded.
   Lifted: keep secrets out of scripts; test with one matching record before enabling.
10. **Standard Webhooks specification v1.0.0** — Standard Webhooks — https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md — date not recorded — Apache-2.0.
    Lifted: id, timestamp and signature headers; signing `id.timestamp.body`; receivers deduplicate on the id.
11. **Designing robust and predictable APIs with idempotency** — Stripe — https://stripe.com/blog/idempotency — 2017-02-22.
    Lifted: idempotency keys built from stable values; retry only with a key.
12. **Idempotent Receiver** and **Dead Letter Channel** — Gregor Hohpe and Bobby Woolf — https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html and https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html — 2003 (book), pages undated.
    Lifted: receivers that tolerate duplicates; a dedicated place for messages that cannot be processed.
13. **Exponential Backoff and Jitter** — Marc Brooker, AWS Architecture Blog — https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ — 2015-03-04.
    Lifted: exponential backoff plus random jitter to avoid synchronised retries; capped waits.
14. **Retry pattern** — Microsoft Azure Architecture Center — https://learn.microsoft.com/en-us/azure/architecture/patterns/retry — 2024-07-18, updated 2025-12.
    Lifted: retry transient faults only; finite attempts; distinguish idempotent operations.
15. **Transient fault handling** — Microsoft Azure Architecture Center — https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults — 2026-02-26.
    Lifted: which error classes are transient; honour `Retry-After`.
16. **Retry policies** and **Saga pattern** — Temporal — https://docs.temporal.io/encyclopedia/retry-policies and https://docs.temporal.io/design-patterns/saga-pattern — date not recorded.
    Lifted: compensations run in reverse and are idempotent.
17. **Error handling in Step Functions** — AWS — https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html — date not recorded.
    Lifted: per-step retry and catch declarations.
18. **Retry steps** — Google Cloud Workflows — https://docs.cloud.google.com/workflows/docs/reference/syntax/retrying — date not recorded.
    Lifted: separate retry predicates from retry schedules.
19. **Record-triggered automation decision guide** — Salesforce — https://architect.salesforce.com/docs/architect/decision-guides/guide/record-triggered.html — date not recorded.
    Lifted: order-of-execution hazards when several automations watch one object.
20. **When record is updated** trigger — Airtable — https://support.airtable.com/docs/when-record-is-updated-trigger — date not recorded.
    Lifted: watch named fields, not whole records.
21. **Workflows FAQ** (loops and re-enrollment) — HubSpot — https://knowledge.hubspot.com/workflows/workflows-faq — date not recorded.
    Lifted: an action that re-qualifies a record for its own workflow creates a loop.
22. **RFC 8058: Signaling One-Click Functionality for List Email Headers** — IETF — https://www.rfc-editor.org/rfc/rfc8058 — January 2017.
    Lifted: `List-Unsubscribe` plus `List-Unsubscribe-Post` for one-click unsubscribe.
23. **Email sender guidelines** — Google — https://support.google.com/a/answer/81126 — enforced from 2024-02-01.
    Lifted: SPF, DKIM, DMARC for senders; one-click unsubscribe for bulk senders.
24. **Design guidelines for better notifications UX** — Vitaly Friedman, Smart Interface Design Patterns — https://smart-interface-design-patterns.com/articles/notifications/ — 2025-07-08.
    Lifted: urgency tiers, batching, snooze.
25. **App design guidelines** — Slack — https://docs.slack.dev/surfaces/app-design/ — date not recorded.
    Lifted: messages that say what happened and what to do, one action each.
26. **Input Validation Cheat Sheet** — OWASP — https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html — date not recorded — licence not recorded.
    Lifted: allowlist validation; reject rather than coerce.
27. **Monitoring distributed systems** — Google SRE Book — https://sre.google/sre-book/monitoring-distributed-systems/ — 2016.
    Lifted: alert on symptoms and rates per service, not on every component error.
28. **n8n skills** — n8n — https://github.com/n8n-io/skills — date not recorded — Apache-2.0; **n8n-skills** — czlonkowski — https://github.com/czlonkowski/n8n-skills — date not recorded.
    Lifted: a lifecycle split between building and debugging; at least three evaluation cases per skill.

Sovrium's own behaviour (retry ranges, timeouts, run statuses, deduplication, the depth guard, the email action's limits) comes from the manual shipped in the binary, `sovrium docs`, and from reading the binary's behaviour, not from these sources.
