# Comment Actions

> Posting, reading and deleting the comments of a record's thread from inside a workflow — as the app, or as the person who triggered it.

A comment written in another tool — a GitHub issue, a CRM note — belongs on the matching record's thread. These three operators put it there without a call to the app's own HTTP API.

| Operator | Props                                                                     | Does                                                                     |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `create` | `table`, `recordId`, `content`, `parentCommentId?`, `mentions?`, `runAs?` | Posts a comment or a reply and returns `{ id, status, parentCommentId }` |
| `list`   | `table`, `recordId`, `limit?`, `runAs?`                                   | Reads the thread, oldest first, as `{ comments, count }`                 |
| `delete` | `table`, `recordId`, `commentId`, `runAs?`                                | Soft-deletes one comment of the thread and returns `{ id }`              |

<!-- sovrium:options CommentActionSchema -->

```yaml
automations:
  - name: acknowledge-request
    trigger:
      type: record
      table: requests
      events: [create]
    actions:
      - name: acknowledge
        type: comment
        operator: create
        props:
          table: requests
          recordId: '{{trigger.record.id}}'
          content: 'Thanks {{trigger.record.requester_name}}, we will answer within two working days.'
```

## Whose comment it is

`runAs` decides it, as on record actions:

- **`system`** (the default) — the comment has no author account and is shown as written by the app. The table's comment permissions do not apply. A list reads every comment that is not deleted, pending and rejected ones included, each with its `status`; a deletion may remove any comment of the thread.
- **`triggering-user`** — the comment is the triggering user's: it carries their name and meets their permissions exactly as their own post would. A list reads what they would read through the comments API; a deletion removes their own comment, or any comment if they moderate. A trigger with no user (a schedule) falls back to `system`.

A run someone started by hand always acts as that person; one a signed-out visitor started has no account to act with. A step its caller may not take — a record they cannot read, a table they cannot comment on, a comment that is not theirs, a comment from another thread, a comment that does not exist — fails with `Resource not found`, and nothing is written or removed.

## What `create` checks

It applies the comments API's own rules: the rendered content must hold 1 to 10,000 characters, a reply must answer a top-level comment of the same record, and the people it mentions — by `@[<user id>]` in `content` or in `mentions` — count only when they can read the record. The table's moderation decides whether the comment is published or queued; a published one starts the table's comment automations.

The per-address rate limit and the spam heuristics (honeypot, blocked words, link threshold) do not apply: they guard against strangers on the internet, and a workflow is not one.

A list never carries an author's email address: a step's output is shown in run history.

## Loops

A comment automation that writes a comment on its own table starts itself again. The chain stops after four automation writes — the limit record writes share — and the step that would go deeper fails, naming the limit.
