# Email & Notification Actions

> Sending transactional email from a running automation, and emitting the named events that notifications and metrics are built from.

## Email — send

One operator. Every recipient field accepts a template, and `cc`, `bcc` and `replyTo` take a single address or an array.

<!-- sovrium:options EmailSendActionSchema -->

`to`, `subject` and `body` are required. `from` falls back to the configured sender.

```yaml
- name: orderConfirmation
  type: email
  operator: send
  props:
    to: '{{trigger.data.customer_email}}'
    subject: 'Order {{trigger.data.id}} confirmed'
    body: 'Thanks for your order. Total: {{trigger.data.amount}}'
    cc: [sales@example.com]
    replyTo: support@example.com
```

### Email needs SMTP configured

With no SMTP host set, email is disabled and a send is **logged rather than delivered**. Sovrium does not quietly fall back to a local mail catcher, because a development convenience that survives into production is a class of outage where every message appears to have been sent.

That also means a green run is not proof of delivery on an instance whose SMTP was never configured. Check the operator environment, not the run history.

## Analytics — track

One operator, emitting a named event with arbitrary properties. It is the foundation for in-app notifications, usage metrics and any downstream sink.

<!-- sovrium:options AnalyticsTrackActionSchema -->

```yaml
- name: trackSignup
  type: analytics
  operator: track
  props:
    event: user.signed_up
    properties:
      userId: '{{trigger.data.id}}'
      plan: '{{trigger.data.plan}}'
```

### Notifications are composed, not configured

There is no notifications block. An event — tracked here, or carried by a record or auth trigger — fans out to channels, and an email send delivers the message. A daily summary is that pair plus a digest collecting across runs and a cron releasing the batch.

The reason to build it from the existing pieces rather than as its own subsystem is that every notification anyone has actually wanted turned out to be a filter, a schedule and a template over an event that already existed.
