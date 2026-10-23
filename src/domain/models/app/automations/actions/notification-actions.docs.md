# Notification Actions

> Notify people from a workflow — one notification per recipient, of a kind the app declares, sent where each recipient chose for that kind.

| Operator | Props                                             | Does                                                            |
| -------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `create` | `kind`, `recipients`, `source?`, `title`, `body?` | Writes one notification per recipient and sends it as she chose |

<!-- sovrium:options NotificationActionSchema -->

```yaml
automations:
  - name: notify-mentions
    trigger:
      type: comment
      table: tickets
      filter: { mentionsOnly: true }
    actions:
      - name: notify
        type: notification
        operator: create
        props:
          kind: mention
          recipients: '{{trigger.mentions}}'
          source: { table: tickets, recordId: '{{trigger.record.id}}' }
          title: '{{trigger.comment.author.name}} mentioned you on {{trigger.record.title}}'
```

`kind` must be declared under the top-level `notifications`. `recipients` is one template that renders a list of user ids, or a list of templates; an id that names no person is skipped. Each recipient's preference for the kind decides where the notification goes: in the app, by email to her account address, or kept for a periodic digest that this version does not yet send (neither listed nor emailed, and removed after `notifications.retention.days`). A long recipient list is written in batches.

`source` names the record the notification is about by table and id only. `title` and `body` are the step's own templates: no field of the record is copied into the notification.
