# Form Success & Error Handling

> What the submitter sees once the submission commits, and what they see when it does not.

The submission commits and the request returns. What happens on screen next is a product decision rather than a technical one: a support ticket wants a reference number, a newsletter signup wants to stay put and accept another address, a checkout wants to move on.

```yaml
forms:
  - id: 1
    name: contact
    title: Contact Sales
    submitTo: { table: leads }
    fields:
      - { kind: table-field, column: email, required: true }
    onSuccess:
      type: successPage
      title: Thank you
      message: We received your message and will reply within one business day.
    onError:
      type: message
      message: Something went wrong saving your request. Please try again.
```

## `onSuccess`

A union discriminated by `type`.

| `type`        | Behaviour                                                            |
| ------------- | -------------------------------------------------------------------- |
| `successPage` | Replaces the form with a success screen                              |
| `redirect`    | Navigates away after an optional delay                               |
| `reset`       | Clears the form for another submission, keeping any preserved fields |
| `toast`       | Shows a transient notification and leaves the filled form in place   |
| `message`     | Replaces the form with an inline message                             |

<!-- sovrium:options FormOnSuccessSchema -->

`delaySeconds` on a redirect defaults to `2`, and `0` navigates immediately.

Omit `onSuccess` entirely and the form falls back to a success toast reading "Submitted." — a sane default, and rarely the one you want in production.

`reset` is the type for a single-page form a submitter fills repeatedly. On a multi-step layout it clears the answers without returning the submitter to the first step, so prefer a success page carrying a reset action there.

## Success-page actions

A success page can offer the submitter a next move; each entry renders as a button.

<!-- sovrium:options SuccessPageActionSchema -->

```yaml
onSuccess:
  type: successPage
  title: Ticket received
  message: Our team has been notified.
  showSummary: true
  actions:
    - { label: Submit another, action: reset }
    - { label: Back to help centre, action: navigate, url: /help }
```

`showSummary` lists the submitted values below the message. It skips hidden fields and applies per-field read permissions, so a summary never shows a submitter something they were not allowed to read back.

## Template variables

Success copy and redirect targets can quote the submission that just happened. Three variables are substituted at submit time, in the title, the message and the URL alike.

| Variable           | Resolves to                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `$submission.id`   | The ledger row id; empty when the form opts out of the ledger                 |
| `$record.id`       | The bound-table row id; empty when the form has no bound table                |
| `$record.<column>` | A column of the inserted row — but only one the submitter themselves supplied |

```yaml
onSuccess:
  type: redirect
  url: /thank-you?ref=$submission.id
  delaySeconds: 0
```

A value substituted into a URL is percent-encoded, so an email address survives the query string intact. The restriction on `$record.<column>` is deliberate: a server-computed or privileged column is never exposed through a redirect URL, however convenient the shortcut would be.

### An unresolved variable becomes empty, never the token

A record reference on a form with no bound table substitutes to nothing, so a URL templating it navigates with an empty parameter. The redirect still fires and the submission is still recorded — you get a silently empty parameter rather than a broken URL or a leaked template string. Check that the target page tolerates an empty value before templating one in.

## `onError`

Covers whole-submission failures: the write was rejected, or the request did not complete.

<!-- sovrium:options FormOnErrorSchema -->

`type` is `toast`, `message` for an inline message, or `errorPage`. `variant` is only meaningful on a toast. Omitted entirely, it falls back to a toast reading "Submission failed."

### Field errors are a different channel

An invalid email or a missing required value comes back as a per-field error list and is rendered inline against the offending input. `onError` fires **alongside** it as the whole-form summary, not instead of it — so an error message written here should read as a summary rather than as the only thing the submitter will see.
