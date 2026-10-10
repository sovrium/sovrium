# Record & Comment Triggers

> The two triggers that fire from activity inside your app — a row changing, and someone talking about a row.

## Record trigger

Fires when records change in a watched table — `create`, `update`, `delete`, and `restore` when a deleted record is brought back from the trash. It fires whichever way the record was written: the records API, a batch call, an upsert, a form, the assistant, a CSV import or another automation, once per record. `sovrium seed` is the exception and fires nothing, and so does an import into a table that declares `import: { fireEvents: false }`.

A `restore` is not a `create`: an automation that greets new records does not run again for one that already existed. On a `restore` the row is at `{{trigger.data.record.*}}` as restored, and `watchFields` does not apply.

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

On an `update`, the `condition` can also read the row as it was **before** the change, at `{{trigger.data.previousRecord.<field>}}`. That lets a condition name a transition rather than a state — "now `paid`, and not `paid` before" starts one run when the order is paid, and none for a later edit of the paid order:

```yaml
trigger:
  type: record
  table: orders
  events: [update]
  condition:
    conditions:
      - field: '{{trigger.data.record.status}}'
        operator: equals
        value: paid
      - field: '{{trigger.data.previousRecord.status}}'
        operator: notEquals
        value: paid
```

A `create` or `delete` has no previous row, so there `{{trigger.data.previousRecord.<field>}}` reads as an empty value: `notEquals paid` holds and `equals draft` does not.

### Writes by other automations

A record an automation writes starts the record automations of its table, exactly as the same write through the records API does — a lead created by a webhook recipe starts the automation that watches new leads. Every record step dispatches, the batch operators included, once per record written. It does not matter where the step sits: a write made inside a branch path, inside a loop (one run per record), or by a code step through `context.actions.record.*` starts them too, under the same loop rules and depth limit as a top-level write.

A loop the configuration shows is refused at validation: an automation whose own `update` step writes a field its trigger's `watchFields` watch — or its own table at all, when the trigger declares no `watchFields` and so watches every field — and one whose `create` step writes into the table whose new records start it. The trigger's own `condition` is read first: when an `equals` or `notEquals` comparison on `{{trigger.data.record.<field>}}` in an `and` group can never hold for the value the step writes into that field — the trigger fires while `status` equals Review and the step writes Scheduled — the write cannot start another run, and it is accepted. A written value that could satisfy the condition again, the same value or one read at run time, is still refused. Two automations whose writes start each other — each one's step writes the other's table, on a field the other watches or on any field when it declares no `watchFields`, and neither trigger has a `condition` — are refused the same way, naming both automations and both tables. A cycle that hangs on a trigger `condition`, or runs through more than two automations, is decided at run time: it stops after four automation writes: a step whose write would start a record automation one level deeper fails without writing, and its run says why in run history; a write that changes no field any automation watches starts nothing and is never refused.

### What the trigger hands you

The row is at **`{{trigger.data.record.*}}`**, also reachable as `{{trigger.record.*}}`. It is **not** flattened, so `{{trigger.data.status}}` does not resolve. It is the row as stored, whatever created it — the records API, a form submission, a dialog or another automation: its `id`, `created_at` and `updated_at`, every column the server stamped (`created-by`, `updated-by`) and every default applied, not only the answers a form posted.

The run can also know who made the write: **`{{trigger.user.id}}`** and **`{{trigger.user.role}}`**, in the same shape a webhook with `auth: { type: session }` hands its run. A record a signed-in person creates, updates, deletes or restores — through the records API, one row at a time or in a batch, a CSV import, the MCP tools or the AI chat — names that person and her role, and each row of a batch names them on its own run. When no person made the write — a step of another automation wrote the row, on any event — both read `system`, as the row's `created-by` column does. A visitor who has not signed in has no `trigger.user`, and neither has a form submission, nor an edit made through a form's edit link. The `id` is a string on every event — create, update and delete alike — as the records API returns it, and so is a relationship value a `condition` or `watchFields` compares, in `record` and in `previousRecord`.

| Path                                | Available on  | Contains                      |
| ----------------------------------- | ------------- | ----------------------------- |
| `{{trigger.data.record.*}}`         | every event   | The row after the change      |
| `{{trigger.data.previousRecord.*}}` | `update` only | The row before the change     |
| `{{trigger.data.records}}`          | batch writes  | The full set of affected rows |

`previousRecord` is what makes "notify when the status _left_ `draft`" expressible without storing state between runs. It is readable everywhere `record` is: in a step's props, in a `filter` step's condition, and in the trigger's own `condition`. A `create` run carries no `previousRecord` at all, and a step reading it gets an empty value rather than a stale row.

Both rows are shaped the same way. A single `user` field holds the user, so `{{trigger.data.record.assignee.email}}` and `{{trigger.data.previousRecord.assignee.email}}` read the address of the person assigned after and before the change. A single many-to-one `relationship` field holds the related row, so `{{trigger.data.previousRecord.customer.name}}` reads a column of the customer the record pointed to before the change. Read on its own, either field is the id it stores, wherever the reference appears: in a step's text, in a `filter` or a trigger `condition`, as a whole `inputData` value a code step receives, and in the props of a step inside a `path` branch or a `loop`. So `contact: '{{trigger.data.record.contact}}'` in a `record/create` links the new row to the same contact at any depth. A field holding several users or several related records is left as its list of ids, in both rows.

A field the table keeps for admins alone — its `permissions.fields` entry has a `read` list naming no role below the admin tier — is never placed in either row, nor in a related row or the reverse row inside it, whoever made the write: a step reads it as an empty value, and the run history never stores it. An automation that needs such a value reads it with a `record/read` step, which names the field on purpose. The trigger's own `condition` reads the related row a step reads — `{{trigger.data.record.customer.country}}` is the customer's country, not an empty value — and, since a condition is never stored, it reads every field of it. A checkbox of a related row reads `true` or `false` on SQLite as on PostgreSQL.

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
