# GDPR & Privacy

> Self-service data export and account erasure — authenticated end users download their data footprint or schedule an irreversible hard delete with a grace period, with the erasure census and its known residuals stated in full.

Sovrium gives end users self-service control over their personal data, satisfying the core GDPR rights without operator intervention. An authenticated user can download a machine-readable copy of their data footprint, and can schedule an irreversible erasure of their account on a timeline that stays reversible until the moment it is not.

This article states exactly what each endpoint covers — and where its boundaries are. An operator answering a data-subject request needs the second half as much as the first.

These are end-user endpoints. They act on the caller's own data, scoped exclusively by the authenticated session; no id is ever taken from the request body.

## Data export (Articles 15 and 20)

`GET /api/account/export` returns the caller's personal-data footprint as structured JSON, satisfying the **right of access** and the **right to data portability**.

```text
GET /api/account/export
Cookie: <session cookie>
```

No request body, query or path parameters — the user id comes only from the session. The response aggregates five sources for the caller:

- **Profile** — the caller's user row.
- **Sessions** — the caller's session rows.
- **Linked accounts** — the caller's OAuth providers and email/password credential, **with all secret material omitted**.
- **Authored records** — every table record the caller authored, across every table declaring a `created-by` field.
- **Form submissions** — every form submission the caller made. Anonymous submissions belong to nobody and are never adopted into somebody's export.

**Authorship is matched by field type, not by column name.** A `created-by` field may carry whatever column name your config gives it — `author`, `submitted_by`, or the literal `created_by`. The export resolves the column from the declared field **type**, so a table naming its authorship field `author` is scanned like any other. Earlier releases matched the literal name only, and returned an empty list with a `200` for such tables — a subject-access response that denied the caller's own records existed.

**Secrets are never exported.** Password hashes, OAuth tokens, second-factor secrets and API keys are stripped from the export. That is a deliberate withholding rather than an oversight: a live bearer token in a JSON download is a security defect, not a data-subject right.

### What the export does not yet carry

The export is narrower than erasure. Erasure hard-deletes several further categories the export payload does not currently offer — among them comments, AI chat transcripts and derived facts, favourites, saved views and table preferences, row-level access grants, the activity feed, and uploaded-file metadata. Widening the export contract to match is a change to the published response schema and is tracked separately; the asymmetry is held against a recorded baseline in the erasure census, so it cannot grow silently.

To satisfy an access request covering one of those categories today, serve it from the operator side through the admin dashboard.

## Account deletion and erasure (Article 17)

`POST /api/account/delete` lets a user request irreversible erasure of their account, satisfying the **right to erasure**. Deletion follows a **scheduled-erasure model with a seven-day grace period** — never an immediate destroy.

```text
POST /api/account/delete
Cookie: <session cookie>
Content-Type: application/json

{ "confirm": true }
```

1. **Schedule** — `{ "confirm": true }` marks the erasure seven days out, revokes all of the caller's sessions so they are logged out everywhere, writes a `account.deletion.scheduled` audit event, and returns `202 Accepted`. Nothing is deleted yet.
2. **Cancel** — during the window the user signs back in and sends `{ "cancel": true }`, which clears the schedule and returns `200 OK`.
3. **Purge** — automatically, after the window: a job **hard-deletes** the caller's identity, credentials, authored records and every other row the erasure census classifies as theirs; sheds their identifier from rows belonging to other people; then writes an `account.deletion.purged` audit event.

A bare `POST` with neither flag is rejected with `400`, against a fat finger.

## What erasure actually removes

The purge is not limited to the auth tables. It sweeps a **census** of every table that references a user, and each table carries one of three explicit verdicts. The census lives in `src/infrastructure/database/account-purge-coverage.ts` and is checked mechanically against the live database schema: adding a user-referencing table without classifying it fails the build, so the list below cannot quietly fall behind the code.

**Deleted** — the rows are the user's own content and are physically removed. Identity and credentials, including sessions, linked accounts, verifications, second factors and API keys; the whole OAuth family, **access tokens included**; organization, team and invitation rows; authored table records; form submissions; comments and read state; row-level grants held by the user; AI conversations, derived facts, tool calls and activity rows; favourites, recent items, saved views and table preferences; third-party connection tokens; uploaded-file metadata, and on the database-backed storage provider the file bytes with it; the activity feed; the operator search-index projection.

**Shed** — the row belongs to somebody else, so the identifier is removed and the row stands. Grants the user **issued** to other people; published short links they created; shared workspace connections; automation runs, pauses and approval decisions; authorship stamps left on records other people wrote; the moderator stamp on other people's comments; the audit trail's actor reference.

**Exempt** — no linkage to purge, or a deliberate retention, each with a stated reason. The canonical audit log, retained as the accountability record; webhook delivery payloads; content embeddings.

Over-deletion is a failure mode too. Deleting a grant because its _issuer_ closed their account would revoke a third party's live access; deleting a published short URL would break traffic other systems depend on. Those rows are shed, not destroyed.

**One category is deliberately kept: the audit trail.** The `account.deletion.purged` event outlives the user it describes — the actor reference is nulled, so the entry survives with the erased address preserved in its metadata. Destroying the audit trail to satisfy erasure would destroy the evidence that the erasure happened. Deleting the data and proving the data was deleted are two separate obligations.

### Known residuals

Erasure is thorough inside the database transaction, and the boundaries of that transaction are worth stating plainly rather than papering over:

- **Files on an external object store.** When `STORAGE_PROVIDER` is `local` or `s3`, the file bytes live outside the database. The purge removes the metadata row, which makes those objects unreferenced — but a transactional delete cannot reach them. Reclaiming them needs an object-store sweep on your side. On the database-backed provider the bytes are removed with the metadata.
- **Webhook delivery payloads.** A delivery payload captures the record verbatim, and the delivery table is keyed to a webhook rather than to a person. There is no predicate on it that identifies the subject, so it is exempt; bound its lifetime with a delivery retention window if your threat model requires it.
- **Content embeddings.** Embeddings index content, never a person. An embedding of a record the erased user authored outlives that record's deletion, because the purge does not know which record ids it removed. This affects every record delete, not only an erased user's, and is tracked on the record-delete path.

## Hard delete, not soft delete

Erasure performs **physical row removal** — not the soft-delete tombstone used elsewhere in the platform. Every row classified as deleted above is gone from the database, and no code path restores it.

This is the deliberate exception to Sovrium's soft-delete-by-default posture: ordinary deletes are recoverable tombstones, whereas an erasure destroys the row outright. The other way to reach a hard delete is `DELETE /api/tables/:tableId/records/:recordId?permanent=true`, reserved for the admin role on **every** table — not something table permissions can grant, and answered `404` rather than `403` for a non-admin caller.

What erasure does **not** claim is that every trace of the person is gone from every system you run. The audit trail is kept on purpose, third-party rows are shed rather than destroyed, and the residuals above sit outside the transaction. An operator answering an erasure request should read those three lists as the honest boundary of what the platform does for them, and cover the remainder themselves.

## Privacy by design

Beyond the self-service rights, privacy is built into the platform defaults:

- **Cookie-free analytics** — visitors are identified by server-side hashes; no personal data and no client identifier is stored, and Do Not Track is respected.
- **Erasure means erasure** — an erasure request hard-deletes the row rather than flagging it. Soft-deleted rows, by contrast, stay recoverable and are not purged on a timer; when they go is your decision, not a platform default.
- **No external services** — all personal data stays on your server; nothing is shipped to a third party.

## Related reading

- **Activity Monitoring** — the audit trail of deletion and access events.
- **Soft Delete and Restore** — the recoverable tombstone model erasure bypasses, and the admin-only permanent delete.
- **Table Permissions** — per-table and field-level access.
- **Security Hardening** — auth, CSRF and anti-enumeration.
- **Analytics** — cookie-free, privacy-first tracking.
