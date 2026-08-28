/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Audit-log action catalog (canonical action -> resource-type mapping).
 *
 * Each entry binds an action name (dot-namespaced, e.g. `config.version.queried`)
 * to the canonical `resource.type` value carried in the emitted entry.
 *
 * THE RULE: `resource.type` names the ENTITY THE ACTION TARGETS — never the
 * action's prefix. A sub-resource gets a dotted compound; its parent domain
 * gets the singular. That is why the catalog cannot be derived mechanically:
 *
 *   - `table.overview.queried`       -> `table`            (targets the table)
 *   - `table.record.button.invoked`  -> `table.record`     (targets one record)
 *   - `form.list.queried`            -> `form`
 *   - `form.submission.list.queried` -> `form.submission`
 *   - `automation.overview.queried`  -> `automation`
 *   - `automation.runs.list.queried` -> `automation.run`
 *
 * `table.record` is therefore NOT an exception — it is the same sub-resource
 * convention `form.submission` and `automation.run` follow, and it is what
 * keeps `?resourceType=table` (table-level readbacks) independently
 * addressable from `?resourceType=table.record` (per-record actions).
 *
 * HISTORICAL NOTE: this header, and several sibling modules and specs, used to
 * cite "audit-log story §305" for a stricter claim — that EVERY `table.*`
 * action carries the singular `table`. That citation was dangling and the claim
 * was wrong. The story it pointed at
 * was deleted in
 * `a76f3608c`; it had 275 lines and no numbered sections, so there was never a
 * §305 to read. Its "Action namespace catalog" table grouped actions by
 * CATEGORY ("categories are derived from the first dot-segment") — not by
 * `resource.type` — and the two actions it listed under `table`
 * (`table.permissions.changed`, `table.index.rebuilt`) have never existed in
 * this catalog. This module is the authority; there is no external rule to
 * defer to.
 *
 * This module is the authoritative source for what `(action, resource.type)`
 * pairs are legitimate. Handlers MUST resolve `resource.type` via
 * `resolveResourceType(action)` so a typo in the action name surfaces as an
 * `undefined` lookup rather than silently producing a resource type that
 * disagrees with the catalog.
 */

/**
 * Canonical action -> resource-type catalog.
 *
 * Keys are action names; values are the singular resource-type label the
 * audit entry must carry. Add new entries when authoring a new audit-emitting
 * endpoint; lookup at write-time guarantees the catalog and the emit agree.
 */
export const ACTION_CATALOG: Readonly<Record<string, string>> = {
  // End-user account deletion events (Phase 8 Cycle 1a — emitted from the
  // /api/account/delete + /api/account/purge-due handlers once the
  // canonical-event-store keystone lands). Both key on the singular `user`
  // resource type — the audit entry's resource is the user being deleted.
  //
  // - `scheduled` fires on a confirmed `POST /api/account/delete { confirm: true }`,
  //   carries severity 'info' + result 'success', actor = the user themself.
  // - `purged`    fires from the background purge job after the grace window
  //   elapses. Severity 'critical' because the action is irreversible;
  //   actor_id is null-ified by the FK ON DELETE SET NULL on the audit_log
  //   table (the user row is gone by the time anyone reads the entry).
  'account.deletion.scheduled': 'user',
  'account.deletion.purged': 'user',
  // Admin config readbacks
  'config.version.queried': 'config',
  // Config-reflection readbacks authorised by [internal ref] amendment A1 (2026-08-14):
  // the App-schema explorer and the env viewer. Both key on the singular
  // `config` resource type — the running configuration is the one entity these
  // reads target, exactly as `config.version.queried` does.
  //
  // These two are audited more consequentially than a version readback: a full
  // config reflection is the broadest read an operator can perform against this
  // instance, so "who read the whole config, and when" is a question the audit
  // trail must be able to answer. They remain severity `info` / result `success`
  // — a READ is not an incident — but they are never emit-on-cold-start
  // optimised away, because the actor is the point.
  'config.schema.queried': 'config',
  'config.env.queried': 'config',
  // The design-system export ([internal ref] amendment A2). Audited for the same
  // reason as the two reflections above: it is a whole-config projection an
  // operator is likely to paste somewhere else, so who exported it, and when,
  // must be answerable afterwards. `config` is the resource — the export
  // describes the running configuration, it is not an entity of its own.
  'config.design.queried': 'config',
  // Schema-config MUTATIONS.
  // Every config-mutation path funnels through `emitAuditEvent` so the Activity
  // feed records who changed the config, how (the `transport` canal), and which
  // action. All key on the singular `config` resource type — the schema config
  // is the single target resource regardless of the mutation verb.
  //   - `schema.draft.update`   — a full-draft PUT (`PUT …/schema/draft`)
  //   - `schema.draft.rebase`   — the file-reconcile rebase (`POST …/draft/rebase`)
  //   - `schema.draft.publish`  — a publish (`POST …/draft/publish`)
  //   - `schema.version.restore`— a version restore (`POST …/versions/:n/restore`)
  'schema.draft.update': 'config',
  'schema.draft.rebase': 'config',
  'schema.draft.publish': 'config',
  'schema.version.restore': 'config',
  // Admin tables overview readback. `table` singular because the action
  // TARGETS the table itself — a naive derivation from the action prefix would
  // produce `table.overview`, which names no entity. This entry is the override.
  'table.overview.queried': 'table',
  // Button-field invocation (POST …/records/:id/buttons/:field). Targets a
  // single RECORD, not the table, so it takes the dotted sub-resource compound
  // — the same convention `form.submission` and `automation.run` follow. That
  // keeps `?resourceType=table.record` returning per-record actions without
  // dragging in every table-level readback, and vice versa.
  //
  // This entry is also the ONLY durable record of who pressed a button:
  // `system.automation_runs` carries no actor column in either dialect, so the
  // caller identity threaded into the run is never persisted alongside it.
  'table.record.button.invoked': 'table.record',
  // Admin buckets readbacks — every `bucket.*` action shares the singular
  // resource type per the audit-log story (added in [internal ref] Lane B merge).
  // `bucket.files.queried` (the per-bucket file browser, [internal ref])
  // keys on `bucket` too: the file enumeration is a read OF a bucket, so the
  // resource is the bucket — `/api/admin/audit-log?resourceType=bucket` returns
  // every bucket-domain action (list, overview, files) with one filter.
  'bucket.list.queried': 'bucket',
  'bucket.overview.queried': 'bucket',
  'bucket.files.queried': 'bucket',
  // Admin console file upload (POST /api/admin/buckets/:name/files). A MUTATION
  // (not a read) but keys on the singular `bucket` resource like every other
  // `bucket.*` action — the upload writes a file INTO a bucket, so the resource
  // is the bucket. `/api/admin/audit-log?resourceType=bucket` thus returns the
  // upload alongside list/overview/files with one filter.
  'bucket.file.uploaded': 'bucket',
  // Admin forms readbacks ([internal ref] Lane B — drain-admin-forms).
  // `form.*` actions key on the singular resource type `form`.
  'form.list.queried': 'form',
  'form.detail.queried': 'form',
  // Admin form-submissions readbacks. Submissions are a sub-resource of
  // form, so the canonical type is the dotted compound `form.submission`
  // (singular). All three of list/detail/bulk share the same compound type
  // so admin UIs can group submission-class entries with one filter.
  'form.submission.list.queried': 'form.submission',
  'form.submission.detail.queried': 'form.submission',
  'form.submission.bulk.queried': 'form.submission',
  // Body reveal (D7) — same resource type, severity escalates at emit time
  // (handler passes severity: 'critical' to emitAuditEvent).
  'form.submission.body.revealed': 'form.submission',
  // F-04 analytics + export endpoints. Aggregate analytics keys on the
  // singular `form` resource (it's a form-level metric), the CSV export
  // keys on `form.submission` (it returns submission rows).
  'form.analytics.queried': 'form',
  'form.export.queried': 'form.submission',
  // Admin users overview readback. The
  // overview endpoint keys on the singular resource type `user` per the
  // single-role-per-user contract; sibling per-user CRUD endpoints (story
  // `admin-user-management.md`) share the same compound-free type.
  'user.overview.queried': 'user',
  // Admin automations readbacks ([internal ref] Lane B — drain-admin-automations).
  // The overview endpoint keys on the singular resource type `automation`
  // (story §6.2 — every `automation.*` action shares the singular type).
  'automation.overview.queried': 'automation',
  // Runs list/detail endpoints (story [internal ref]). Runs
  // are a sub-resource of automation, so the canonical type is the dotted
  // compound `automation.run` (singular). Both list and detail share the
  // same compound type so admin UIs can group run-class entries with one
  // filter.
  'automation.runs.list.queried': 'automation.run',
  'automation.runs.detail.queried': 'automation.run',
  // Operational pause/resume. The FIRST
  // audited automation MUTATIONS — every `automation.*` entry above is a
  // readback, and the sibling `POST /runs/:runId/retry` emits nothing today.
  // Past-tense verb per the mutation convention (`bucket.file.uploaded`,
  // `account.deletion.purged`). Keyed on the singular `automation` type: a
  // pause is a state change OF an automation, not of a run, so one
  // `?resourceType=automation` filter returns pause history alongside the
  // overview readbacks.
  //
  // These two entries are load-bearing, not documentation: `emitAuditEvent`
  // looks the action up here and SILENTLY DROPS the emit (a warning only) when
  // it is absent — so an unregistered action means the audit row is never
  // written and nothing fails loudly.
  'automation.paused': 'automation',
  'automation.resumed': 'automation',
  // Admin agent-conversations readbacks. The
  // conversation list + detail endpoints both key on the singular `agent`
  // resource type — a conversation read is a read OF an agent's history, so
  // the resource is the agent. Uniform with `agent.*` (e.g. the sibling
  // agent-metrics endpoint would emit on `agent` too): one
  // `/api/admin/audit-log?resourceType=agent` filter returns every
  // agent-domain action. Mirrors the `bucket.files.queried` precedent
  // (the per-bucket file browser keys on `bucket`, not `bucket.files`).
  'agent.conversation.list.queried': 'agent',
  'agent.conversation.detail.queried': 'agent',
  // The agent INDEX readback (`GET /api/admin/agents`) keys on the same
  // singular `agent` type as its conversation siblings, so one
  // `?resourceType=agent` filter still returns every agent-domain action.
  'agent.list.queried': 'agent',
  // Admin app-connections readbacks. The connection
  // list + detail endpoints both key on the singular `connection` resource
  // type — a connection read is a read OF a connection, so the resource is the
  // connection. Uniform with the sibling per-connection call-history endpoint
  // (`/api/admin/connections/:name/calls`): one
  // `/api/admin/audit-log?resourceType=connection` filter returns every
  // connection-domain action. Mirrors the `bucket.files.queried` →
  // `bucket` / `agent.conversation.list.queried` → `agent` precedents (the
  // sub-resource read keys on the parent resource type, not a compound type).
  'connection.list.queried': 'connection',
  'connection.detail.queried': 'connection',

  // Short-link mutations. All five key on the
  // singular `link`, so one `?resourceType=link` filter returns a link's whole
  // operational history — which is the question an operator actually asks
  // ("what happened to /l/spring-promo?"), and it is only answerable if the
  // enable/disable overlay shares a resource type with create and delete.
  //
  // These are WRITES, unlike most of the catalog above: `emitAuditEvent` DROPS
  // an unregistered action with a warning rather than throwing, so a mutation
  // missing from here would succeed while leaving no trace and failing no test.
  'link.created': 'link',
  'link.updated': 'link',
  'link.deleted': 'link',
  'link.disabled': 'link',
  'link.enabled': 'link',

  // Design-system share links ([internal ref] amendment A3 Part 2). Both key on the
  // singular `design.share`, following the `link.*` precedent for the same
  // reason: one `?resourceType=design.share` filter answers "what happened to
  // this share?", which is only possible if mint and revoke share a type.
  //
  // WRITES, like the `link.*` block above — and consequential ones. Publishing
  // an app's design principles, voice guidance and per-component usage rules to
  // the anonymous internet is at least as worth recording as minting a
  // redirect, and `emitAuditEvent` DROPS an unregistered action with a warning
  // rather than throwing, so an entry missing from here would leave the
  // publication with no trace at all.
  //
  // Segment spelling is load-bearing: `action-catalog.test.ts` pins
  // `/^[a-z]+(\.[a-z]+)+$/`, so `design.share-link.created` reads more
  // naturally and fails the test. Dots, never hyphens.
  'design.share.created': 'design.share',
  'design.share.revoked': 'design.share',
}

/**
 * Resolve the canonical resource type for an action.
 *
 * Returns `undefined` when the action is not in the catalog — emitters MUST
 * treat that as a programming error (the action was never registered) rather
 * than silently emitting a derived value.
 */
export function resolveResourceType(action: string): string | undefined {
  return ACTION_CATALOG[action]
}

/**
 * Named-constant view of the action catalog for ergonomic use at emit sites
 * (`AUDIT_ACTIONS.BUCKET_LIST_QUERIED`). Kept in sync with `ACTION_CATALOG`
 * by hand; if you add a new action above, add the matching constant here.
 */
export const AUDIT_ACTIONS = {
  ACCOUNT_DELETION_SCHEDULED: 'account.deletion.scheduled',
  ACCOUNT_DELETION_PURGED: 'account.deletion.purged',
  CONFIG_VERSION_QUERIED: 'config.version.queried',
  CONFIG_SCHEMA_QUERIED: 'config.schema.queried',
  CONFIG_ENV_QUERIED: 'config.env.queried',
  CONFIG_DESIGN_QUERIED: 'config.design.queried',
  SCHEMA_DRAFT_UPDATE: 'schema.draft.update',
  SCHEMA_DRAFT_REBASE: 'schema.draft.rebase',
  SCHEMA_DRAFT_PUBLISH: 'schema.draft.publish',
  SCHEMA_VERSION_RESTORE: 'schema.version.restore',
  TABLE_OVERVIEW_QUERIED: 'table.overview.queried',
  TABLE_RECORD_BUTTON_INVOKED: 'table.record.button.invoked',
  BUCKET_LIST_QUERIED: 'bucket.list.queried',
  BUCKET_OVERVIEW_QUERIED: 'bucket.overview.queried',
  BUCKET_FILES_QUERIED: 'bucket.files.queried',
  BUCKET_FILE_UPLOADED: 'bucket.file.uploaded',
  FORM_LIST_QUERIED: 'form.list.queried',
  FORM_DETAIL_QUERIED: 'form.detail.queried',
  FORM_SUBMISSION_LIST_QUERIED: 'form.submission.list.queried',
  FORM_SUBMISSION_DETAIL_QUERIED: 'form.submission.detail.queried',
  FORM_SUBMISSION_BULK_QUERIED: 'form.submission.bulk.queried',
  FORM_SUBMISSION_BODY_REVEALED: 'form.submission.body.revealed',
  FORM_ANALYTICS_QUERIED: 'form.analytics.queried',
  FORM_EXPORT_QUERIED: 'form.export.queried',
  USER_OVERVIEW_QUERIED: 'user.overview.queried',
  AUTOMATION_OVERVIEW_QUERIED: 'automation.overview.queried',
  AUTOMATION_RUNS_LIST_QUERIED: 'automation.runs.list.queried',
  AUTOMATION_RUNS_DETAIL_QUERIED: 'automation.runs.detail.queried',
  AUTOMATION_PAUSED: 'automation.paused',
  AUTOMATION_RESUMED: 'automation.resumed',
  AGENT_LIST_QUERIED: 'agent.list.queried',
  AGENT_CONVERSATION_LIST_QUERIED: 'agent.conversation.list.queried',
  AGENT_CONVERSATION_DETAIL_QUERIED: 'agent.conversation.detail.queried',
  CONNECTION_LIST_QUERIED: 'connection.list.queried',
  CONNECTION_DETAIL_QUERIED: 'connection.detail.queried',
  LINK_CREATED: 'link.created',
  LINK_UPDATED: 'link.updated',
  LINK_DELETED: 'link.deleted',
  LINK_DISABLED: 'link.disabled',
  LINK_ENABLED: 'link.enabled',
  DESIGN_SHARE_CREATED: 'design.share.created',
  DESIGN_SHARE_REVOKED: 'design.share.revoked',
} as const

/** @public — union of all valid audit action codes. */
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
