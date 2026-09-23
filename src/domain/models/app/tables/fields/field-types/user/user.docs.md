# User & Audit Fields

> The four user and audit field types — user, created-by, updated-by and deleted-by — that reference accounts and record who did what.

Four field types reference users from the authentication system. Three are auto-populated audit fields tracking who created, updated or deleted a record; one is an editable reference. All of them accept the base field properties every field type shares.

Only `user` is bound to the account table. It emits a foreign key to Better Auth's user table — `auth.user` on PostgreSQL, `auth_user` on SQLite — so it needs `auth` configured to be usable. The three authorship types emit no foreign key at all: they are plain columns the engine stamps from the session, which is why the paragraph at the end of this page is true.

| Type         | Behaviour                                                             |
| ------------ | --------------------------------------------------------------------- |
| `user`       | Editable reference to a user. Single or multiple selection.           |
| `created-by` | Auto-set to the user who created the record. Read-only.               |
| `updated-by` | Auto-set to the user who last modified the record. Read-only.         |
| `deleted-by` | Auto-set to the user who soft-deleted the record. `NULL` when active. |

## `user`

An editable reference to one or more accounts — an assignee, a reviewer, a watcher list.

Its foreign key is `ON DELETE SET NULL`: deleting the account clears the reference and keeps the record. An assignment names a person rather than being that person's content, so the row survives them — and it is what keeps an assigned account erasable at all.

<!-- sovrium:options UserFieldSchema -->

```yaml
- { id: 1, name: assignee, type: user }
```

## Authorship fields

`created-by`, `updated-by` and `deleted-by` are written by the engine from the authenticated session. A client cannot set them: a request that tries is not refused, but the engine builds an override from the session and stamps it over whatever was sent, because the only trustworthy source for "who did this" is the session that did it.

<!-- sovrium:options CreatedByFieldSchema -->

<!-- sovrium:options UpdatedByFieldSchema -->

<!-- sovrium:options DeletedByFieldSchema -->

```yaml
- { id: 2, name: created_by, type: created-by }
- { id: 3, name: updated_by, type: updated-by }
- { id: 4, name: deleted_by, type: deleted-by }
```

The column name is yours. The engine finds these fields by `type` rather than by a reserved name, so a table may call its author column `author` and be stamped identically — which is what makes the audit trail work on a schema someone migrated in from elsewhere.

**The audit TIMESTAMPS do not work this way**, and the difference catches people. `created-at`, `updated-at` and `deleted-at` are matched by NAME, so renaming one of those leaves the engine using its own automatic column beside yours — see **Date & Time Fields**.

An unauthenticated write leaves an authorship field null rather than failing. That is deliberate: a public form submission is a legitimate record with no account behind it, and refusing it would make authorship fields unusable on exactly the tables that most need a submission trail.
