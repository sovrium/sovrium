# Send transactional email from Sovrium

> Wire Sovrium to an SMTP provider so auth emails and automation email actions send for real — one set of `SMTP_` environment variables.

Password resets, email verification, magic links and automation email actions all need an outbound mail path. Sovrium sends through any SMTP provider, or through your own server.

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

Until `SMTP_HOST` is set, email is disabled and send attempts are logged rather than delivered — safe for local development. In development the whole message goes to the journal, links included, so a reset link can be copied straight out of the terminal; in production only a one-line notice naming the recipient and subject is logged. The startup banner warns about the missing transport when — and only when — the config makes email load-bearing. See **Troubleshooting: Auth, Email & MCP**.

## Verify

Trigger a password reset, or run an automation with an email action; the message arrives at its destination. The startup summary shows email as enabled once `SMTP_HOST` is set.

## Next

- **Auth Overview** — the flows that send verification and reset email.
- **Automation Email Actions** — sending email from a workflow.
- **Environment Variables** — every `SMTP_` variable, including `SMTP_SECURE`.
