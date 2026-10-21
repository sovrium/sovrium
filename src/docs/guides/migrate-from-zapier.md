# Migrate from Zapier to Sovrium

> Leave Zapier for a self-hosted Sovrium app: import your Zapier Tables and your Zaps with `sovrium import`, finish what the report lists, then switch the automations on one at a time.

A Zapier "Zap" is a trigger followed by action steps. A Sovrium automation is the same shape, declared in config and run on your own server, with no task limits. `sovrium import` converts both halves of a Zapier account: each Zapier Tables table from its CSV download, and every Zap from a Zap export, each written as a disabled automation with a list of what to finish.

## 1. Import your Zapier Tables

Zapier Tables has no API the import reads, so each table comes from its CSV download: open the table, then its menu, then **Download**. Show every field and clear every filter first, because a download holds only what the table showed.

```bash
sovrium import ./customers.csv --config app.yaml                  # preview
sovrium import ./customers.csv --config app.yaml --write --apply  # write, then seed
```

The download is recognised by its `tables_record_id`, `tables_created_at` and `tables_updated_at` columns. Each record keeps its Zapier id and creation time, and each column is typed from its values. The report says what it could not keep:

```text
Simplified or left out (3):
  customers linked records: Zapier Tables writes a linked record as its display text, and the download holds one table: a linked-record column is kept as that text, not as a link.
  customers hidden fields and filtered records: A Zapier Tables download holds only the fields and records the table showed when it was downloaded; hidden fields and filtered-out records are not in it.
  customers.Signed up: Zapier Tables wrote this date in its display format with a two-digit year; it was read month first, in the 2000s.
```

Import each table the same way, then turn the linked-record columns that matter into relationship fields. The details are in [Migrating Tables and Records](/en/docs/cli-import-tables).

## 2. Import your Zaps

In Zapier, open **Settings**, then **Data management**, and choose **Export my data**: Zapier emails a ZIP holding `Zapfile.json`, every Zap of the account. The Zaps list's **Export Zaps** download works too, and so does a folder of one-Zap JSON files.

```bash
sovrium import ./zapier-export.zip --config app.yaml            # preview
sovrium import ./zapier-export.zip --config app.yaml --write    # write
```

Every Zap becomes an automation with `enabled: false`, named after the Zap. What converts:

| Zapier                                  | Sovrium                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Trigger: Catch Hook                     | a `webhook` trigger                                                      |
| Trigger: Schedule                       | a `cron` trigger, when the export states its time and day                |
| Trigger: Typeform                       | a `webhook` trigger you point Typeform at                                |
| Trigger: Airtable new or updated record | a TODO naming the table, until it is a `record` trigger on your table    |
| Paths                                   | a `path/branch` running every path whose rules match                     |
| Filter                                  | a `filter/continue`                                                      |
| Webhooks by Zapier                      | an `http/request`; a catch-hook address moves to an environment variable |
| Delay                                   | a `delay/wait`                                                           |
| Code by Zapier                          | a TypeScript stub keeping the code as comments                           |
| Slack, HubSpot, Gmail                   | a connection and a `connection/call` step                                |
| `{{1__email}}` mapping                  | `{{trigger.data.email}}`, or `{{<step>.result.email}}` for a later step  |

Steps with no exact equivalent, such as an Airtable record step or a Formatter step, are kept as TODOs the report lists. An app step lands on a connection shared across the import: the library's own when the library holds the app (Dropbox, Mailjet, Typeform, Jotform and Webflow included), one written from the vendor's documented endpoints when the import knows it, a bearer connection otherwise. Each required input the step does not give is a `{{todo.<name>}}` placeholder. A one-Zap file read from Zapier's API carries no step inputs: its app steps are still typed connection calls, every input a placeholder, and only a filter is kept as a stub. The full rules are in [Migrating Automations](/en/docs/cli-import-automations).

## 3. Finish each automation

Work through the TODO list the report prints, automation by automation. For each one, reconnect the apps it uses by setting the variables the report names (connections never leave Zapier), rewrite its code stubs, fill what the stubs quote, and replace each `{{todo.<name>}}` placeholder with its value: `sovrium validate` refuses an automation switched on while one is left. A finished automation reads like one you wrote:

```yaml
automations:
  - name: notify-on-new-lead
    enabled: false
    trigger:
      type: record
      table: leads
      events: [create]
    actions:
      - type: http
        operator: request
        name: post_to_webhook
        props:
          method: POST
          url: $env.NOTIFY_ON_NEW_LEAD_POST_TO_WEBHOOK_URL
          body:
            email: '{{trigger.data.email}}'
```

A Zap that other tools called through a Catch Hook gets a new address once it is a Sovrium `webhook` trigger: point those tools at it.

## 4. Switch the automations on one at a time

```bash
sovrium start app.yaml
```

Set `enabled: true` on one automation, run it alongside the original Zap for a while, and check each run under `/_admin/runs`. Then turn the Zap off in Zapier and move to the next one, so no event is handled twice.

## What does not come across

- **Connections**: no Zapier export carries a credential, so each app is reconnected in Sovrium.
- **Zapier Interfaces** have no import.
- **App connectors** neither the library nor the import knows get a bearer connection named after the app, and their steps an `http/request` on it whose address you fill in.
