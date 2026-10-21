# What to remove before reporting

Everything pasted into an issue is public and permanent: edits keep their history, and copies of public repositories are indexed within minutes. Remove a secret before it is pasted; if one was already published, rotate it — deleting the text does not un-publish it.

## Remove

- **Credentials written into the configuration**: a `password`, `token`, `key`, `secret` or `clientSecret` whose value is the credential itself rather than an `$env.NAME` reference. Replace the value with `[redacted]`.
- **`env` defaults**: the `default` of an `env` entry is secret unless the entry says `secret: false`. Replace it with `[redacted]`.
- **Environment values**: anything copied from `.env`, from `sovrium env`, or from the server's environment — `DATABASE_URL` (it holds the database password), `AUTH_SECRET`, `SOVRIUM_ENCRYPTION_KEY`, API keys, webhook signing secrets.
- **The data directory**: never paste files from `.sovrium/` — the database, the encryption key, stored uploads.
- **People's data**: real names, email addresses, phone numbers, addresses and record contents from the app. Replace them with neutral examples that still show the problem.
- **Paths and hosts**: the user's home directory and project path (`/Users/ada/clients/acme/…` becomes `./…`), internal host names, IP addresses, customer names in domain names.
- **Tokens in error text and logs**: session cookies, `Authorization` headers, signed URLs (`?signature=…`, `?token=…`), API keys in query strings.

## Keep

- `$env.NAME` references: they name a variable, not its value.
- Table, field, page and automation names, once neutral.
- The error class, the message and Sovrium's own stack frames: they are how the maintainers find the bug.
- The signature `[sig:…]` and the request id: neither reveals anything about the app.

## Check

Read the finished report once, top to bottom, as a stranger would, before it is submitted. When in doubt about a value, remove it and describe it instead ("a 40-character API key").
