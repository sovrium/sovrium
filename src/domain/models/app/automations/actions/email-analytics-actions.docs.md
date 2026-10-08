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

### Values from a request or a record are checked and escaped

An email step is often fed text nobody on the team wrote — a form submission, a webhook body, a record. That text can fill a field, but it cannot change who the message goes to, who it comes from, or what it looks like:

- **Recipients.** A `to`, `cc`, `bcc` or `replyTo` value that comes from a template must be exactly one address, and so must each item of a list. A value that brings a second address or a separator (`,` or `;`) fails the step, naming the field, and nothing is sent. A list written in the config itself is sent as written.
- **Sender.** Write `from` in the config, as text or `$env.SENDER`. A `from` taken from a template fails the step.
- **Body.** A value placed in `body` is shown as text: `<`, `>` and `&` in it are escaped, with `{{value}}` and `{{{value}}}` alike, so it cannot add a link, an image or a layout. The markup you write in the body around it renders as usual. The plain-text part and the subject show the value unchanged.

To place rich text on purpose — a note your team edits in a rich-text field — use `{{{safeHtml value}}}`. Its formatting (bold, lists, paragraphs, links) is kept and anything unsafe, such as a script, is removed.

```yaml
body: |
  <h2>Receipt</h2>
  <p>Thanks {{trigger.data.name}}.</p>
  {{{safeHtml steps.order.record.note}}}
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
