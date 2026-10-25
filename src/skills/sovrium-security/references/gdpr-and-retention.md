# Personal data: export, erasure, retention, logs

## Contents

- The two self-service rights
- What erasure leaves, by design and by limit
- Retention you can declare
- Logs
- What stays the operator's
- Checks

Manual: `sovrium docs operations/gdpr-privacy`, `sovrium docs operations/logs-and-personal-data`, `sovrium docs tables/table-retention`, `sovrium docs configuration/env-vars-ai`, `sovrium docs admin/analytics`.

## The two self-service rights

- **Access and portability** (GDPR Articles 15 and 20): `GET /api/account/export`, signed in, returns the caller's profile, sessions, linked accounts with secrets stripped, the records she authored in every table that declares a `created-by` field (with only the fields she may read), her form submissions, audit entries she made, chat files and conversations, agent facts about her, favourites and recent items. Authorship is found by the field **type**, so a `created-by` field may have any name. A table with no `created-by` field contributes nothing to anyone's export: add one where people's own records live.
- **Erasure** (GDPR Article 17): `POST /api/account/delete` with `{ "confirm": true }` schedules erasure seven days out and signs her out everywhere; `{ "cancel": true }` within the window undoes it. With `auth.immediateAccountDeletion` (on by default when email works), a mailed link erases at once. The purge hard-deletes, it does not soft-delete. The last admin who can sign in is refused.

The export is narrower than the erasure: comments, row-level grants, the activity feed and uploaded files are erased but not exported. Serve an access request covering those from the operator console.

## What erasure leaves, by design and by limit

Tell the operator, before launch, so the privacy notice is true:

- **Kept on purpose**: the audit trail, with the actor's id and email removed; the deletion event keeps the erased address as proof the erasure happened.
- **Shed, not deleted**: rows that belong to someone else lose her identifier and stay (grants she issued, links she published, fields naming her in other people's records).
- **Out of reach**: files stored with no uploader (an anonymous form, an automation, `sovrium seed`); webhook delivery payloads; content embeddings of records she wrote; values typed into free text that name her; log lines already written.

## Retention you can declare

- `tables[].retention: { field, days }` deletes rows older than the window, for good, in a daily sweep; it starts no automation and writes no history. Use it on log-like and event tables.
- `tables[].activityLog: false` keeps a machine-written table out of the activity log (no before and after values stored per change). Only where nobody will ask who changed a row.
- `AI_MEMORY_MAX_AGE_DAYS` deletes a user's chat conversations, and the files sent in them, once idle that long. Unset, they are kept until she deletes them or her account is erased.
- `analytics.retentionDays` bounds page-view analytics; analytics are cookie-free and store no client identifier.
- Soft-deleted records stay recoverable and are not purged on a timer.

## Logs

Sovrium keeps no log file. Console output, OTLP log records and error reports are stored by whatever you run: a process manager, a collector, an error tracker. Credentials in log attributes are replaced by `[redacted]`, and error reports copy only four request headers and redact query values, but logs still hold personal data (ids, paths naming records, error text quoting a value). Set a retention period where each stream lands, restrict who reads them like the database, and state the period in the privacy notice. Erasure does not reach a line already written.

## What stays the operator's

A privacy notice and a record of processing (Article 30), the reverse proxy's access logs, backups and their expiry, the object store, the hosting contract, and any data an automation sends to a third party. Sovrium sends no personal data to a third party by itself.

## Checks

```
- [ ] Sign up a test account, create a record, upload a file, chat once
- [ ] GET /api/account/export as that account → the record, the chat, the submission are there
- [ ] POST /api/account/delete { "confirm": true } → 202, signed out everywhere
- [ ] After the purge (or the immediate link): the record, the file bytes and the chat are gone
- [ ] Every table where people's own data lives has a created-by field
- [ ] Log-like tables declare retention; AI_MEMORY_MAX_AGE_DAYS is set if chats hold personal data
- [ ] The privacy notice names the log, backup and chat retention periods
```
