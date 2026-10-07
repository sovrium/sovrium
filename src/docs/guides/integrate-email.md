# Send transactional email from Sovrium

> Wire Sovrium to an SMTP provider, or to the email API of Brevo, Resend or Amazon SES, so auth emails and automation email actions send for real.

Password resets, email verification, magic links and automation email actions all need an outbound mail path. Sovrium sends through any SMTP provider or your own server by default, or through the HTTP API of Brevo, Resend or Amazon SES.

## Configure SMTP

```bash
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_USER=<username>
export SMTP_PASS=<password>
export SMTP_FROM=no-reply@example.com
export SMTP_FROM_NAME="My App"
sovrium start app.yaml
```

`SMTP_FROM_NAME` is the display name recipients see beside the sender address. Leave it unset and emails go out under your app's `name`; `Sovrium` is used only when neither is available.

Until `SMTP_HOST` is set, email is disabled and send attempts are logged rather than delivered — safe for local development. In development the whole message goes to the journal, links included, so a reset link can be copied straight out of the terminal; in production only a one-line notice naming the recipient and subject is logged. The startup banner warns about the missing transport when — and only when — the config makes email load-bearing. See **Troubleshooting: Auth, Email & MCP**.

## Send through an email API instead of SMTP

When outbound port 587 is blocked on your host, or you already use a transactional email service, select its HTTP API with `EMAIL_PROVIDER` and give it its credentials:

```bash
export EMAIL_PROVIDER=brevo
export BREVO_API_KEY=<your Brevo API key>
export SMTP_FROM=no-reply@example.com
export SMTP_FROM_NAME="My App"
sovrium start app.yaml
```

| `EMAIL_PROVIDER` | Credentials                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| `brevo`          | `BREVO_API_KEY`                                                              |
| `resend`         | `RESEND_API_KEY`                                                             |
| `ses`            | `EMAIL_SES_REGION`, `EMAIL_SES_ACCESS_KEY_ID`, `EMAIL_SES_SECRET_ACCESS_KEY` |

SMTP stays the default: leave `EMAIL_PROVIDER` unset and nothing changes. A key alone never switches the transport — a `BREVO_API_KEY` set for a Brevo connection leaves your mail on SMTP until `EMAIL_PROVIDER=brevo` says otherwise. `SMTP_FROM` and `SMTP_FROM_NAME` still name the sender, whichever transport carries the message. Auth emails and automation email actions take the same road.

A misconfiguration refuses to start: an `EMAIL_PROVIDER` value that names no transport, or a selected transport with a missing credential, stops the server at boot and names the variable. If the provider later refuses a message — a revoked key, an unverified sender — the email step fails with the provider's name and the HTTP status it answered, never with the key. `EMAIL_API_URL` points the transport at a regional endpoint or a relay in front of the provider.

## Verify

Trigger a password reset, or run an automation with an email action; the message arrives at its destination. The startup summary shows email as enabled once `SMTP_HOST` is set, or once `EMAIL_PROVIDER` names an API whose credentials are all set.

## Next

- **Auth Overview** — the flows that send verification and reset email.
- **Automation Email Actions** — sending email from a workflow.
- **Environment Variables** — every email variable, including `SMTP_SECURE` and `EMAIL_API_URL`.
