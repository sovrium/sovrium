# Operator Notifications

> The two emails an instance sends its operators on its own — an alert when an automation fails, and a weekly summary of the whole instance — who receives them, what they contain, and every variable that shapes them.

A running instance tells its operators about itself by email, without anybody opening the console. There are two such emails:

- **Automation alerts** — sent when an automation fails after its last retry, times out, is interrupted by a server restart, or is paused or resumed.
- **Weekly summary** — once a week, what the automations, the data and the instance did, compared with the week before, and what is waiting on an operator.

Both are free and built into the binary. Both need working email delivery, configured with the `SMTP_*` variables, and both are better with `BASE_URL` set: it is what makes the links in them absolute. Without it the emails still go out, with no links.

## Who receives them

Each email has its own audience, resolved the same way:

1. Every admin-tier account of the app — every role the operator console admits — that is not banned and has left that email **on** in its profile. Only apps that declare an `auth:` block have accounts.
2. Every address listed in `SOVRIUM_NOTIFY_TO`, whatever the app declares. For an app with no `auth:` block, these addresses are the whole audience.

An address that appears in both is written to once. Each account owns its own two switches, **Automation alerts** and **Weekly summary**, on its profile page in the console (`/_admin/profile`); both start on, and switching one off silences that email for that account alone. Every operator email links back to that page.

## Automation alerts

The first final failure of an automation is emailed at once, naming the automation, the run and the error. Further failures of the same automation within the next hour are held back and collected into **one hourly summary** that says how many more times it failed, its last error, and when it recovered if a later run succeeded. A summary lost to a restart is not caught up: every automation in it already had its first failure emailed.

A run that was still in progress when the server stopped is closed at the next boot as failed with the error `Interrupted: the server stopped during this run`, and alerted like any other failure. Pausing or resuming an automation from the console emails the other recipients, naming who did it.

With `SOVRIUM_AUTOMATION_AUTOPAUSE=<n>`, the platform pauses an automation itself after `n` final failures in a row, and says so by email. Unset — the default — nothing is ever paused automatically.

## The weekly summary

The summary goes out on `SOVRIUM_NOTIFY_DIGEST_CRON` — Mondays at 08:00 by default — read in the operator timezone, `SOVRIUM_TIMEZONE`. Its period starts exactly where the previous summary ended, so consecutive summaries leave no gap and count nothing twice; every date in it is written on the operator's calendar and the email names the zone. It reports:

- **Automations** — runs, failures (of which timed out and interrupted), the success rate, the five automations that failed most with each one's last error, summarised, and every paused automation, automatic pauses marked.
- **Data** — rows per table and the distinct rows written during the week, accounts created, accounts that signed in, form submissions, and files uploaded with their size.
- **Instance** — the size of the database and of file storage, how many connections are healthy, engine version changes, and error and critical audit entries grouped by action, the five most frequent.
- **Waiting on you** — unset environment variables, expired connection tokens, pending invitations.

Every summary is kept, so the next one can show row counts and sizes as changes against it. The first summary an instance ever sends covers the seven days before it and is marked as a **baseline week**: there is nothing to compare with yet.

**What it never contains.** The summary carries counts, and the names of your tables, automations and audit actions. It never contains a record value, a submitted value, an account's email address or its name. The only free text is a failing automation's last error, summarised the same way as in the alert emails: its first line only, with a database's detail block removed except the column a duplicate key names, whose value is replaced (`Key (email)=(…)`), any password in a connection URL masked, capped at 200 characters. It is still the error an upstream service returned, so keep secrets out of what your integrations echo back.

**When the server was down.** At boot, a summary that is more than a week overdue is caught up with **one** summary covering the whole missed stretch, not one per missed week. A recent summary whose delivery failed is sent again. An instance that has never sent one waits for its first scheduled run.

**Single instance.** The boot catch-up and the interrupted-run sweep each assume they are the only server on the database. Two servers sharing one database would both send the catch-up and could close each other's running runs; run one.

## Variables

| Variable                       | Default     | Effect                                                                                    |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| `SOVRIUM_NOTIFY_AUTOMATIONS`   | `on`        | `off` stops every automation alert for the whole instance                                 |
| `SOVRIUM_NOTIFY_DIGEST`        | `weekly`    | `off` stops the weekly summary for the whole instance, and nothing is stored or caught up |
| `SOVRIUM_NOTIFY_DIGEST_CRON`   | `0 8 * * 1` | When the summary goes out, as a five-field cron expression in the operator timezone       |
| `SOVRIUM_NOTIFY_TO`            | unset       | Comma-separated extra addresses that receive both emails                                  |
| `SOVRIUM_AUTOMATION_AUTOPAUSE` | unset       | Pause an automation after this many final failures in a row; unset never pauses           |
| `SOVRIUM_TIMEZONE`             | `UTC`       | The zone the summary is scheduled in and its dates are written in                         |
| `BASE_URL`                     | unset       | The public origin every link in these emails is built from                                |

Every one of them is validated at boot. A wrong value — `SOVRIUM_NOTIFY_DIGEST=daily`, a cron expression with six fields, an entry of `SOVRIUM_NOTIFY_TO` that is not an email address — refuses to start the server, naming the variable and the value, rather than failing silently the week the email is due. Changing one takes effect on the next restart.
