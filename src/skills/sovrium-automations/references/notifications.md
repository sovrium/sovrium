# Notifications and email

## Contents

- Decide the urgency first
- Digest over drip
- Snooze and opt-out
- Writing the message
- Email: before the first send
- Bulk email
- Other channels
- Checklist

Manual: `sovrium docs automation-integrations/automation-email-actions`, `sovrium docs automation-actions/automation-crypto-digest`, `sovrium docs guides-integrations/integrate-email`.

## Decide the urgency first

| Tier      | When                                                  | Delivery                                                      |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Immediate | A person must act now, or money or safety is at stake | Email or chat message at once, to the one person who must act |
| Batched   | Useful to know, not urgent                            | One digest per hour or day                                    |
| Silent    | Visible in the app, nobody needs to be told           | No message; a list or badge in the app                        |

Most events are batched or silent. If everything is immediate, nothing is.

## Digest over drip

Sovrium composes notifications from existing pieces rather than a notifications block:

1. The event-triggered automation runs a `digest` step with `operator: collect` and a `digestKey`.
2. A cron-triggered automation runs `operator: release` on the same `digestKey`, and sends one message with the batch.

Releasing drains the bucket, so a missed schedule accumulates events instead of losing them. Keep the two automations separate.

## Snooze and opt-out

- Store each person's preference (a field on the user's profile record, or a `notification_settings` table): tier per event type, quiet hours, snoozed until.
- Check the preference in the automation's condition before sending.
- Anything not immediate can be turned off by the recipient.

## Writing the message

- Subject or first line says what happened and what, if anything, to do.
- One action per message, linked directly to the record.
- No secrets, tokens or personal data beyond what the recipient already sees in the app.
- Templates referencing a path that does not resolve render empty rather than failing: send one test message and read it.

## Email: before the first send

- SMTP must be configured for the instance. Without it, a send is **logged, not delivered**, and the run still reads as completed. Check the operator environment, not the run history.
- The sending domain needs SPF, DKIM and DMARC records. Major mailbox providers enforce this for bulk senders and increasingly for everyone.
- `from` is an address on that domain; `replyTo` is where replies should go.
- Recipients come from real addresses: `{{trigger.mentionedEmails}}` holds addresses, `{{trigger.mentions}}` holds user ids.

## Bulk email

Newsletters, announcements, and anything sent to many people at once need:

- a one-click unsubscribe (`List-Unsubscribe` and `List-Unsubscribe-Post` headers, per RFC 8058) honoured within two days;
- a visible unsubscribe link in the body;
- a low complaint rate.

Sovrium's `email` action does not set custom headers today, so it cannot add the one-click unsubscribe headers. Send bulk email through a dedicated email provider's API (look for a recipe or connection with `sovrium library search <provider>`), and keep Sovrium's `email` action for transactional messages to one recipient.

## Other channels

Chat messages (Slack and similar) go through an `http` step or a library connection. Keep them for the immediate tier and for shared team channels; direct messages to individuals follow the same urgency rules as email.

## Checklist

```
- [ ] Each notification has a tier; most are batched or silent
- [ ] Batched ones use digest collect + release on a cron
- [ ] Recipients can snooze or opt out of non-immediate notifications
- [ ] SMTP configured and one real test message received and read
- [ ] Sending domain has SPF, DKIM, DMARC
- [ ] Bulk email goes through a provider that sets one-click unsubscribe
```
