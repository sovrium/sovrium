# Record & Comment Triggers

> The two triggers that fire from activity inside your app — a row changing, and someone talking about a row.

## Record trigger

Fires when records change in a watched table.

```yaml
trigger:
  type: record
  table: orders
  events: [create, update]
  watchFields: [status]
  condition:
    conditions:
      - field: '{{trigger.data.record.status}}'
        operator: equals
        value: paid
```

<!-- sovrium:options RecordTriggerSchema -->

`watchFields` and `condition` answer different questions. `watchFields` asks **what changed**; `condition` asks **what the row now looks like**. The example above fires only when `status` was touched _and_ the resulting status is `paid` — an order edited from `pending` to `paid` fires, an order whose shipping address is corrected does not.

Using `condition` alone on an `update` event fires on every edit to a matching row, which is rarely what a notification wants.

### Writes by other automations

A record an automation writes starts the record automations of its table, exactly as the same write through the records API does — a lead created by a webhook recipe starts the automation that watches new leads. The single-record `create`, `update`, `upsert` and `delete` steps dispatch; the batch operators do not.

A loop the configuration shows is refused at validation: an automation whose own `update` step writes a field its trigger's `watchFields` watch — or its own table at all, when the trigger declares no `watchFields` and so watches every field — and one whose `create` step writes into the table whose new records start it. The trigger's own `condition` is read first: when an `equals` or `notEquals` comparison on `{{trigger.data.record.<field>}}` in an `and` group can never hold for the value the step writes into that field — the trigger fires while `status` equals Review and the step writes Scheduled — the write cannot start another run, and it is accepted. A written value that could satisfy the condition again, the same value or one read at run time, is still refused. Two automations whose writes start each other — each one's step writes the other's table, on a field the other watches or on any field when it declares no `watchFields`, and neither trigger has a `condition` — are refused the same way, naming both automations and both tables. A cycle that hangs on a trigger `condition`, or runs through more than two automations, is decided at run time: it stops after four automation writes: a step whose write would start a record automation one level deeper fails without writing, and its run says why in run history; a write that changes no field any automation watches starts nothing and is never refused.

### What the trigger hands you

The row is at **`{{trigger.data.record.*}}`**, also reachable as `{{trigger.record.*}}`. It is **not** flattened, so `{{trigger.data.status}}` does not resolve. It is the row as stored, whatever created it — the records API, a form submission, a dialog or another automation: its `id`, every column the server stamped (`created-by`, `created-at`) and every default applied, not only the answers a form posted. The `id` is a string on every event — create, update and delete alike — as the records API returns it, and so is a relationship value a `condition` or `watchFields` compares, in `record` and in `previousRecord`.

| Path                                | Available on  | Contains                      |
| ----------------------------------- | ------------- | ----------------------------- |
| `{{trigger.data.record.*}}`         | every event   | The row after the change      |
| `{{trigger.data.previousRecord.*}}` | `update` only | The row before the change     |
| `{{trigger.data.records}}`          | batch writes  | The full set of affected rows |

`previousRecord` is what makes "notify when the status _left_ `draft`" expressible without storing state between runs.

## Comment trigger

Fires when a comment is created on a record in a table that has comments enabled.

```yaml
trigger:
  type: comment
  table: tickets
  when: created
  filter: { mentionsOnly: true }
```

<!-- sovrium:options CommentTriggerSchema -->

<!-- sovrium:options CommentTriggerFilterSchema -->

`topLevelOnly` and `repliesOnly` are mutually exclusive.

Pick `when` by what the automation does. `approved` is right for anything user-visible, since a moderated comment should not page a channel before a human has cleared it. `created` is right for an internal notification that wants the comment the moment it lands. `when` defaults to `created`.

### `respectReadPermissions` is opt-out

It defaults to `true`, honouring the table's row-level read predicate against the **comment's author**. Set it to `false` deliberately, and only where the automation must fire for every comment regardless of who wrote it — turning it off is what lets a run act on a record its own trigger's author could not see.

### What the trigger hands you

A comment trigger supplies the comment, the record it hangs from, and two ready-made audiences — enough to notify a thread without a single lookup.

| Path                                      | Type         | Contains                                                         |
| ----------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `$trigger.comment.id`                     | UUID         | The comment row                                                  |
| `$trigger.comment.body`                   | string       | The comment body, as rich text                                   |
| `$trigger.comment.author.{id,email,name}` | string       | Who wrote it                                                     |
| `$trigger.comment.parentCommentId`        | UUID or null | `null` on a top-level comment; the parent's id on a reply        |
| `$trigger.record.*`                       | object       | The record the comment was posted on                             |
| `$trigger.threadParticipants`             | UUID array   | Everyone who has written on the thread, excluding the new author |
| `$trigger.mentions`                       | UUID array   | The users the comment mentions who can read the record           |
| `$trigger.mentionedEmails`                | string array | Those same users' addresses, excluding the comment's own author  |

**`mentions` holds ids; `mentionedEmails` holds addresses.** Only the second is a usable recipient: `to: '{{trigger.mentions}}'` renders a comma-joined list of user ids and the send fails for want of an address.

```yaml
- name: notifyMentioned
  type: email
  operator: send
  props:
    to: '{{trigger.mentionedEmails}}'
    subject: 'You were mentioned on {{trigger.record.title}}'
    body: '{{trigger.comment.author.name}} wrote: {{trigger.comment.body}}'
```

A mention is either `@[<user id>]` markup in the body — what the page's comment composer writes when someone types `@` and picks a person — or an id in the create request's `mentions` array; the two are merged. A name typed by hand without picking it, such as `@Carol Dupont`, is plain text and mentions nobody. Only people who can read the record count: a mention of someone the table's `read` permission or row-level read rule refuses, or of an id that belongs to nobody, never reaches `mentions` or `mentionedEmails`, and never fires a `mentionsOnly` automation.

`mentionedEmails` drops the comment's own author even where they mention themselves, so nobody is emailed about their own comment. Repeat mentions of one person collapse to a single address, and a mention whose user no longer exists is skipped rather than failing the run — a half-delivered notification beats a comment endpoint that swallows its own automation. Pair it with `filter: { mentionsOnly: true }` so the automation runs only when there is somebody to notify.
