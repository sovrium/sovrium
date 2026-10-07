# Logs and Personal Data

> What a Sovrium server writes to its logs, what it strips before a line leaves the process, what an operator must still treat as personal data, and how logs relate to retention and erasure.

A running instance produces three streams of diagnostic output. Each is written by the engine, but every one of them is **stored by something you run**: a process manager, a log collector, an error-tracking service. Sovrium keeps no log file of its own and has no setting that deletes log lines. This article says what reaches each stream, so you can decide where to send it and how long to keep it.

## The three streams

| Stream           | Enabled by                                                          | What it carries                                                                                                                   |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Console          | Always                                                              | One human-readable line per event on stdout, and the full cause chain of an error on stderr                                       |
| OTLP log records | `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | The same lines as structured records, with their attributes (a request id, a job name, an entity id) and the trace they belong to |
| Error reports    | `SENTRY_DSN`                                                        | Each captured error with its stack, the request method and URL, and a short list of request headers                               |

`LOG_LEVEL` sets how much of the console stream you see. At the default level, debug narration is left out; `LOG_LEVEL=debug` adds it.

## What is stripped by default

These protections are on for every instance and have no switch to turn them off.

**Credentials in log attributes.** Before a line's structured attributes leave the process, every attribute whose name contains `authorization`, `cookie`, `token`, `secret`, `password`, `api-key` / `api_key` or `private-key` / `private_key` (in any case) has its value replaced by `[redacted]`, and so does any value that starts with a `Bearer` or `Basic` scheme, whatever its name. The attribute itself stays, because "a token was sent" is often what you need to know; the token does not.

**Messages carry no values.** A log message is a short, stable sentence that names the subsystem and the event. Values — ids, names, addresses — travel as attributes, where the rule above applies, rather than inside the sentence.

**Error reports.** An error report copies only four request headers: `user-agent`, `accept`, `content-type` and `referer`. Cookies and the `Authorization` header are never copied, because a header is included only by being on that list. Every query-string value in the reported URL is replaced by `[REDACTED]`; the parameter names stay.

## What is still personal data

Redaction removes credentials. It does not make a log anonymous, and you should treat all three streams as containing personal data:

- **Identifiers.** Attributes carry record ids, user ids and run ids, which identify a person once joined with the database.
- **Request details in error reports.** The URL path can name a record (`/tables/contacts/records/42`), the `referer` can name the page a person came from, and the `user-agent` describes their device.
- **Error causes.** The cause chain written to stderr, and the exception in an error report, contain whatever text the failing library put in its message. A database constraint error can quote the value that broke the constraint — an email address, a name.
- **What your proxy adds.** Access logs written by a reverse proxy in front of Sovrium (client address, full URL, timestamps) are outside the engine entirely, and usually the most identifying stream of all.

## Retention

Sovrium does not retain logs: a console line exists once it is written to stdout, an OTLP record once your collector accepts it, an error report once your tracking service stores it. Retention is therefore set **where the stream lands**:

- the process manager or container runtime that captures stdout and stderr (journald, Docker's logging driver, your platform's log drain);
- the collector and backend behind the OTLP endpoint;
- the project settings of the error-tracking service behind `SENTRY_DSN`.

Pick a period that matches why you keep logs — diagnosing incidents rarely needs more than a few weeks — and write it into your record of processing.

## Erasure and logs

Erasing an account (see the GDPR & Privacy article) hard-deletes the person's data **from the database**. It does not reach log lines already written: they are held by the systems listed under Retention, which the engine cannot address.

That is the usual position, and it is defensible when two things are true:

1. Logs are kept for a short, stated period, after which they expire on their own — so an erased person's identifiers leave the logs within that period without further action.
2. Logs are not used to rebuild what erasure removed. A user id surviving in a log line is a pointer to nothing once the account is gone.

If a data subject asks for erasure from the logs as well, apply it where the logs live: most collectors and tracking services can delete by search, and an error report can be deleted from the tracking service's issue view.

## Checklist

- Send stdout and stderr somewhere with a retention period you chose, not an unbounded default.
- Give the OTLP backend and the error-tracking project the same, or a shorter, retention.
- Restrict who can read those systems as tightly as who can read the database.
- Configure your reverse proxy's access log on the same terms, or turn off the fields you do not need.
- State the log retention period in your privacy notice and record of processing.
