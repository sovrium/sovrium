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

### Templates and attachments

Instead of `body`, a message can be rendered from a template: `template` is `{ asset: <path> }`, `{ key, bucket }` or `{ inline: <html> }`, filled from `data`, which is the template's whole context (`{{invoice.number}}`, never `{{trigger.data.…}}`). `text` renders the plain-text part from the same `data`, without HTML escaping; without it, the plain-text part is derived from the final HTML (see below). A step sets exactly one of `body` and `template`; `data`, `text`, a templated `subject`, `inlineCss` and `locale` need `template`, and `validate` refuses them without it.

A template written in the config (`inline`) or read from `assets` was written by you and ships with the config, so it keeps its inline `style` and the table layout attributes email clients need (`cellpadding`, `cellspacing`, `align`, `bgcolor`, …); each style value is checked against an email-safe list, so nothing that loads a resource, computes or repositions survives, and a `<style>` element never does. A template from a bucket — which anyone allowed to write to that bucket could replace — is cleaned like `body`, which removes `style`. Whatever its origin, a value from `data` is escaped where it lands; rich text goes through `{{{safeHtml value}}}`.

### Rendering a templated email

- **Subject.** A string subject is filled by the run, as before — `'Your invoice {{trigger.data.number}}'` still reads the trigger. With `template`, the subject may itself be a template source — `subject: { inline: 'Invoice {{invoice.number}} — {{formatCurrency invoice.total "EUR"}}' }` — rendered from `data` with the helpers, partials and translations of the body, and never HTML-escaped.
- **Styles.** A `<style>` block in an inline or asset template is inlined onto the elements it matches (`inlineCss`, default `true`), then each inlined declaration is checked against the same email-safe list as a `style` attribute — `position` or a `background-image` is dropped, the colour kept. The block itself is never sent, and `inlineCss: false` drops it without inlining. A linked stylesheet is removed, never fetched. A template stored in a bucket loses every style.
- **Plain-text part.** Without `text`, the plain-text part is derived from the HTML: a link reads `label (address)` (the address once when it is its own label), a simple table is one line per row with `|` between cells, paragraphs are separated by a blank line, and nothing of a style or script block appears.
- **Layouts.** A shared frame is a layout partial (`{{#> layouts/email}}…{{/layouts/email}}`), its styles inlined like the template's own.
- **Pictures.** `{{image}}` and `{{qrcode}}` travel as inline parts of the message, shown through `cid:` — never as a `data:` URL or inline SVG, which mail clients drop. Through the Brevo API, which takes no inline parts, a picture is written into the HTML as a `data:` URL instead.
- **Language.** `locale` picks the language of `{{t}}` and of the amount and date helpers, per message when it reads the run.

`attachments` lists files to attach, in order: `{ step: <name> }` (a document a previous step generated), a key, `{ key, bucket }`, `{ asset: <path> }`, `{ record: { table, id, field, index? } }` or `{ url }` — or one template resolving to such a list. A list that arrives with the run's data (`'{{trigger.data.files}}'`) may only name files this run produced — `{ step: <name> }`, or a temporary file a step of this run wrote (a step that only reads stored files, such as `file/list` or `file/getMetadata`, wrote none); a key, `{ key, bucket }`, `{ asset }`, `{ record }` or `{ url }` from run data fails the step, and nothing is sent. A `{ record }` reference reads the record as the run does: in a run someone started by hand, a record they cannot read is not found. Each is attached under its filename and content type. Attachments travel whole or not at all: if one cannot be read, the step fails and nothing is sent. A message carries at most **15 MB** of attachments (15 × 1024 × 1024 bytes, the files' own sizes added up with the pictures a template shows inline); above that the step fails with `attachments_too_large` and nothing is sent — put a larger file in a bucket and send a link to it.

```yaml
- name: mailInvoice
  type: email
  operator: send
  props:
    to: '{{trigger.data.customerEmail}}'
    subject: 'Your invoice {{trigger.data.number}}'
    template: { asset: templates/invoice-email.html }
    text: { asset: templates/invoice-email.txt }
    data: { invoice: '{{trigger.data}}' }
    attachments:
      - { step: renderInvoice }
      - { key: legal/terms-2026.pdf, bucket: library }
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
