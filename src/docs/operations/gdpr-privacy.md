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

No request body, query or path parameters — the user id comes only from the session. The response aggregates six sources for the caller:

- **Profile** — the caller's user row.
- **Sessions** — the caller's session rows.
- **Linked accounts** — the caller's OAuth providers and email/password credential, **with all secret material omitted**.
- **Authored records** — every table record the caller authored, across every table declaring a `created-by` field.
- **Form submissions** — every form submission the caller made. Anonymous submissions belong to nobody and are never adopted into somebody's export.
- **Audit trail** — every admin audit-log entry the caller made, newest first, as `{ action, occurredAt, resourceType, resourceId, result }`. The entry's metadata is left out, because it can describe somebody else (a role change carries the target's roles). Entries in which the caller was only the account acted upon (their role was changed, for example) are another person's act and are not listed.

**The order is stable.** Form submissions and audit-trail entries are listed newest first; entries stamped with the same instant follow by id, highest first, so two exports of the same account list the same entries in the same order.

**Authorship is matched by field type, not by column name.** A `created-by` field may carry whatever column name your config gives it — `author`, `submitted_by`, or the literal `created_by`. The export resolves the column from the declared field **type**, so a table naming its authorship field `author` is scanned like any other. Earlier releases matched the literal name only, and returned an empty list with a `200` for such tables — a subject-access response that denied the caller's own records existed.

**Secrets are never exported.** Password hashes, OAuth tokens, second-factor secrets and API keys are stripped from the export. That is a deliberate withholding rather than an oversight: a live bearer token in a JSON download is a security defect, not a data-subject right.

### What the export does not yet carry

The export is narrower than erasure. Erasure hard-deletes several further categories the export payload does not currently offer — among them comments, AI chat transcripts and derived facts, favourites, saved views and table preferences, row-level access grants, the activity feed, and uploaded-file metadata. Widening the export contract to match is a change to the published response schema and is tracked separately; the asymmetry is held against a recorded baseline in the erasure census, so it cannot grow silently.

To satisfy an access request covering one of those categories today, serve it from the operator side through the admin dashboard.

## Account deletion and erasure (Article 17)

`POST /api/account/delete` lets a user request irreversible erasure of their account, satisfying the **right to erasure**. Deletion follows a **scheduled-erasure model with a seven-day grace period**; the immediate door below replaces the grace period with a link mailed to the account.

```text
POST /api/account/delete
Cookie: <session cookie>
Content-Type: application/json

{ "confirm": true }
```

1. **Schedule** — `{ "confirm": true }` marks the erasure seven days out, revokes all of the caller's sessions so they are logged out everywhere, writes a `account.deletion.scheduled` audit event, and returns `202 Accepted`. Nothing is deleted yet. The last admin who can still sign in is refused with `409`, and nothing is scheduled.
2. **Cancel** — during the window the user signs back in and sends `{ "cancel": true }`, which clears the schedule and returns `200 OK`.
3. **Purge** — automatically, after the window: a job **hard-deletes** the caller's identity, credentials, authored records and every other row the erasure census classifies as theirs; sheds their identifier from rows belonging to other people; then writes an `account.deletion.purged` audit event.

If the account due for erasure is the last one that can administer the app, the sweep leaves it in place and tries again every hour; it is erased by the first sweep after someone else holds the admin role. The pending erasure stays visible to its owner, who can still cancel it, and the audit trail records `account.deletion.deferred` once.

A bare `POST` with neither flag is rejected with `400`, against a fat finger.

### Immediate deletion by mailed link

A user can also delete their account immediately (`auth.immediateAccountDeletion`, on by default when email is configured): `POST /api/auth/delete-user` mails a confirmation link; following it while signed in as that account erases the account with the same sweep as the scheduled purge, and signs the browser out. The link is valid for 24 hours and works once. With `auth.immediateAccountDeletion: false`, or on an instance that cannot send email, the endpoint answers `404` and the scheduled deletion above remains the way out.

The last admin who can sign in is refused on both doors, with `409`. The trail records `account.deletion.requested` on the request and `account.deletion.purged` on the erasure.

> **Upgrade note.** Immediate deletion arrived after 0.29.1, and it is **on by default**: an app upgrading from 0.29.1 or earlier with email configured lets every signed-in user erase their own account without the seven-day window, by following a mailed link, the moment it restarts. That is what the right to erasure asks for; if your app must keep the seven-day window as the only way out — a legal hold, a review before erasure — set `auth.immediateAccountDeletion: false` before the new version starts. 0.29.1 does not know that key and refuses it, so add it after `sovrium update` and check it with `sovrium validate` before you restart. The confirmation link is mailed through the `accountDeletion` email template, whose meaning changed with it: read Email Templates before you upgrade if your app customises that template.

## What erasure actually removes

The purge is not limited to the auth tables. It sweeps a **census** of every table that references a user, and each table carries one of three explicit verdicts. The census lives in `src/infrastructure/database/account-purge-coverage.ts` and is checked mechanically against the live database schema: adding a user-referencing table without classifying it fails the build, so the list below cannot quietly fall behind the code.

**Deleted** — the rows are the user's own content and are physically removed. Identity and credentials, including sessions, linked accounts, verifications, second factors and API keys; the whole OAuth family, **access tokens included**; organization, team and invitation rows; authored table records; records the config deletes with their authored records (`onDelete: 'cascade'`); form submissions; comments and read state; row-level grants held by the user; AI conversations, derived facts, tool calls and activity rows; favourites, recent items, saved views and table preferences; third-party connection tokens; uploaded-file metadata, and on the database-backed storage provider the file bytes with it; the activity feed; the operator search-index projection.

**Shed** — the row belongs to somebody else, so the identifier is removed and the row stands. Grants the user **issued** to other people; published short links they created; shared workspace connections; automation pauses and approval decisions, and the account that started a run; every field naming the user in a record somebody else wrote — a user field, a last-editor or deleted-by stamp — with the lookups and formulas reading it; the moderator stamp on other people's comments; the audit trail's actor reference and actor email address.

**Scrubbed** — an automation run stays in the app's history, but what it read does not. Every run that read one of the user's records, a record naming the user, or a record removed with the user's own keeps its steps, statuses and timings, and loses its trigger data, every step's input, output, error and logs, and its own error; it is marked "values erased" with the date, and leaves the operator search. Each run records which records it read — through its trigger, record steps, agent tool calls and script calls — so this is exact, not a search for the user's id. Runs recorded before 0.30.0 kept no such record, so the upgrade scrubs them once, the same way — a run still waiting for an approval at the first start after it ends.

**Exempt** — no linkage to purge, or a deliberate retention, each with a stated reason. The canonical audit log, retained as the accountability record; webhook delivery payloads; content embeddings.

Over-deletion is a failure mode too. Deleting a grant because its _issuer_ closed their account would revoke a third party's live access; deleting a published short URL would break traffic other systems depend on. Those rows are shed, not destroyed.

**One category is deliberately kept: the audit trail.** The entries the user made stay, as acts carrying the actor's tier, with both their id and their email address removed. The `account.deletion.purged` event outlives the user it describes too, with the erased address preserved in its metadata — the only place the address survives. Destroying the audit trail to satisfy erasure would destroy the evidence that the erasure happened. Deleting the data and proving the data was deleted are two separate obligations.

### Known residuals

Erasure is thorough inside the database transaction, and the boundaries of that transaction are worth stating plainly rather than papering over:

- **Files on an external object store.** When `STORAGE_PROVIDER` is `local` or `s3`, the file bytes live outside the database. The purge removes the metadata row, which makes those objects unreferenced — but a transactional delete cannot reach them. Reclaiming them needs an object-store sweep on your side. On the database-backed provider the bytes are removed with the metadata.
- **Webhook delivery payloads.** A delivery payload captures the record verbatim, and the delivery table is keyed to a webhook rather than to a person. There is no predicate on it that identifies the subject, so it is exempt; bound its lifetime with a delivery retention window if your threat model requires it.
- **Content embeddings.** Embeddings index content, never a person. An embedding of a record the erased user authored outlives that record's deletion, because the purge does not know which record ids it removed. This affects every record delete, not only an erased user's, and is tracked on the record-delete path.
- **Values from outside the app.** A webhook's request body, an anonymous form's answers, and text someone typed into a field — a name in a text field, an id pasted into a JSON value — name nobody the platform can match. Erasure does not reach them, in records or in the runs that captured them.

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
