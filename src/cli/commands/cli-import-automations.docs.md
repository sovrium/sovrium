# Migrating Automations

> Turn n8n workflows, Make scenarios, Zapier Zaps, Retool workflows, Baserow workflows and Webflow form webhooks into Sovrium automations, every one written disabled, with a TODO list for what did not translate.

Every automation source follows the two stages of [Migrating From Another Tool](/en/docs/cli-import). Every automation an import writes has `enabled: false`: nothing runs until you have reviewed it, set the variables it reads, and switched it on.

## The sources at a glance

| Source                | How to get it                                                                                            | What maps                                                                                 | What degrades                                                                                          | What is reported                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| n8n                   | `n8n:<instance URL>` with an API key in `N8N_API_KEY`; or a file from `n8n export:workflow`              | triggers, HTTP, IF, Switch, Filter, Loop Over Items, Wait, mapped app steps               | code steps become stubs keeping the original as comments                                               | unmapped nodes, untranslated expressions, inactive and archived workflows             |
| Make                  | `make:<zone>/<teamId>` with a token in `MAKE_TOKEN`; or a file from **Export blueprint**                 | webhooks, schedules, routers, If-else, filters, iterators, sleeps, mapped modules         | an export file holds no schedule                                                                       | error handlers, unmapped modules, mixed AND/OR filters                                |
| Baserow               | the workspace export ZIP                                                                                 | row triggers on the imported tables, router paths                                         | row actions and router conditions are Baserow formulas, kept as TODOs                                  | everything an API token cannot read                                                   |
| Webflow form webhooks | `webflow:<siteId>` with a site token holding `sites:read`                                                | each `form_submission` webhook, as a form trigger and one HTTP step                       | the webhook's address moves to an environment variable                                                 | Logic, other webhook types, webhooks added in the dashboard                           |
| Zapier                | `Zapfile.json` from **Export my data** (or its ZIP), the **Export Zaps** download, or one-Zap JSON files | Catch Hook and Schedule triggers, Paths, Filters, Code, webhooks, Delay, mapped app steps | a Form or Airtable trigger whose form or table is not imported; one-Zap API files carry no step inputs | unmapped steps, Formatter steps, connections to reconnect                             |
| Retool Workflows      | the workflow's **Export to JSON** file                                                                   | webhook and schedule starts, Branch, REST requests, Loop, Response                        | code blocks become stubs; a Branch statement other than a plain comparison is a TODO                   | resource queries (SQL and the rest), whose resource the export omits; unmapped blocks |
| Airtable automations  | not in Airtable's Web API: readable through the Airtable MCP server, not imported                        | —                                                                                         | —                                                                                                      | named in every Airtable report                                                        |
| Notion automations    | no API or export exposes them                                                                            | —                                                                                         | —                                                                                                      | named in every Notion report                                                          |

## What every automation becomes

- A schedule trigger keeps its cron expression; a webhook trigger keeps its method; a manual trigger stays manual.
- An HTTP request step becomes `http/request`. A credential header is never copied, and an address that is itself a credential moves to `$env.<AUTOMATION>_<STEP>_URL`, as described in [Migrating From Another Tool](/en/docs/cli-import).
- An app step lands on a connection shared by every automation of the import: one per app per source account. The first account met is named after the app (`google`), the next ones `google-2`, `google-3`, as `sovrium library add connection/google --as google-2` names them, and each reads its own secrets as that command writes them (`APIFY_2_TOKEN` for `apify-2`; an OAuth application's client ID and secret stay shared); a step whose export names no account shares the first one. The report gives, for each connection, the source account it stands for, where its definition comes from, the operations called, the variable NAMES to set and, for OAuth, where to register the OAuth application. Each `env[]` entry declares a NAME, never a value.
- **An app the connection library holds** is installed exactly as `sovrium library add` installs it: the fragment under `library/connection/`, wired by one `$ref` line (a TypeScript config gets the import line to paste), its variable names appended to `.env.example`, and each operation of the provider's generated set the steps call appended as `sovrium library add <provider>/<operation>` appends it. Running `sovrium library add` for the same connection or operation afterwards changes nothing. A config that already holds the library connection keeps it, gaining only the operations it lacks; a connection you wrote yourself under that name is never touched, and the import uses the next free name instead.
- **An app the library does not hold yet but the import knows** (pdfFiller, Mailparser) gets its connection written in place in `connections[]`, from the vendor's documented endpoints. Dropbox, Mailjet, Typeform, Jotform, Webflow, Trello, MeisterTask and Google Sheets are library connections, installed as above.
- **An app nothing knows**, such as a private Zapier integration, gets a bearer connection named after it, whose base URL and token are read from `<APP>_BASE_URL` and `<APP>_TOKEN`.
- The step becomes a `connection/call` of the operation behind it, carrying the inputs that operation declares. A required input the step does not give is written `{{todo.<name>}}` and its TODO names it. An action whose endpoint is not declared, on a connection the import writes in place, becomes an `http/request` on that connection, its method or address written as `{{todo.*}}` placeholders where they are not known; nothing is invented. A Slack, Gmail, Google Calendar, GitHub, Mailchimp or Discord node that leaves its resource or operation at n8n's default (a Slack node that posts a message names neither) is read with that default.
- An app trigger that the vendor points at a webhook, such as lemlist campaign activity, becomes a `webhook` trigger, and its connection declares the operation that registers the webhook; the trigger's TODO names it. A Typeform, Jotform or Webflow form trigger whose form is not imported in the same run does the same with `put-webhook`, `create-form-webhook` or `create-webhook`; a form imported with it stays a `form` trigger.
- From Zapier and n8n, a new Trello card, a new Calendly invitee and a new Facebook or LinkedIn lead-form response become `webhook` triggers the same way; the TODO says what the vendor checks before it sends anything, and that Meta and LinkedIn must approve your app for lead access. A trigger the vendor cannot push, a new MeisterTask task or a new Google Sheets row, becomes a `cron` trigger, every 15 minutes until you set its schedule, and the automation polls: it lists the items first, keeps the ones it has not seen with `state/filterNew` when they carry an id, then runs its steps once per new item, which read the item where they read the trigger. Sheet rows carry no id, so their TODO asks you to keep only the rows past the last one seen before switching it on.
- A code step becomes a TypeScript stub that keeps every line of the original as a comment. It runs nothing until you rewrite it.
- A step with no mapping becomes the same kind of stub, quoting the step's definition, so the automation keeps its shape.
- A branch becomes a `path/branch`, a filter a `filter/continue`, a loop a `loop/each` and a wait a `delay/wait`.
- Each automation is named after its source in kebab case. A Sovrium automation name holds at most 100 characters, so a longer one keeps its start and ends with a short hash of the whole title: the same title always gets the same name, two titles never share one, and the report gives the full title beside it.

The report counts the TODOs of each automation: one reading **ready to review** has none. It also names each automation that was switched on in the source, so you know which to switch on first.

## n8n

```bash
export N8N_API_KEY=…
sovrium import fetch n8n:https://acme.app.n8n.cloud
sovrium import .sovrium-imports/n8n-… --config app.yaml --write
```

`n8n:<instance URL>` reads an n8n Cloud or self-hosted instance through its public API, with an API key created under **Settings › n8n API** (n8n's Cloud trial does not offer one). `n8n:acme.app.n8n.cloud` is read as `https://acme.app.n8n.cloud`, and a URL ending in `/api/v1` is accepted as written. The file `n8n export:workflow` writes converts the same way, with no key.

- **Read-only.** The fetch sends only `GET` requests: the workflow list, 250 a page, and a single workflow only when the list served it without its nodes. Pinned sample data is never requested.
- **No secret leaves n8n.** A workflow names the credentials its nodes use, never their values; the fetch never reads credentials, and n8n's decrypted export is never used. The API key travels only in the `X-N8N-API-KEY` header, to the instance you named.
- **The instance must be reached safely.** Its URL must use `https` (plain `http` is accepted for a loopback host only), and must not carry a user name, a password, a query or a fragment. A private or link-local address is refused unless private outbound requests are allowed on this machine (`SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`). A refusal never repeats the URL.

What the workflows become:

- An IF or Switch node becomes a `path/branch` with one path per output, in order, running the first path that matches; a Switch that sends items to every matching output runs every matching path. A comparison with no exact Sovrium equivalent, such as a case-insensitive text test, is left out of the path's condition and listed as a TODO.
- A Filter node at the top of the workflow stops the run when its condition fails. Inside a path or a loop it only gates the steps after it there, so it becomes a path around them.
- A Loop Over Items node becomes a `loop/each` around the steps of its loop, which read the current item as `{{loop.item.…}}`. The list it walks has no Sovrium equivalent, so it is a TODO. A Wait node becomes a `delay/wait`. A no-op node is dropped, and the report says so.
- App steps map when the node names its operation: posting or updating a Slack message, sending with Gmail or Outlook, creating a Google Calendar event, upserting a HubSpot contact, creating a Notion database page, a GitHub or Jira issue, or a Pipedrive person, adding a Mailchimp member, sending a Discord message or a Twilio SMS. An Airtable node on the base you are migrating becomes a `record` step on the imported table.
- Expressions are rewritten: n8n's `{{ $json.score }}` reads the previous step and becomes `{{score_lead.result.score}}`; a read of the trigger becomes `{{trigger.data.…}}`. An expression that does not translate is a TODO.
- An **inactive** workflow is imported like an active one, and the report says which were switched on in n8n. An **archived** workflow is imported too, and the report notes it, so you can delete what you no longer want.

## Make

A Make scenario is read from the file the scenario editor's **Export blueprint** writes, from one `GET /scenarios/{id}/blueprint` answer, or from a `make:` snapshot. The zone is the host of your Make dashboard (`eu1`, `eu2`, `us1`, `us2`, or a full host such as `eu1.make.celonis.com`), and the API token needs the `scenarios:read` scope. The fetch lists the team's scenarios, then reads each blueprint, sending only `GET` requests, and waits out Make's rate limit for as long as its `Retry-After` asks.

```bash
export MAKE_TOKEN=…
sovrium import fetch make:eu1/123456
sovrium import ./blueprint.json --config app.yaml --write
```

- A webhook module becomes a `webhook` trigger. A scenario with no trigger module runs on its schedule: an interval that divides the hour or the day, or a daily time, becomes a `cron` trigger. An export file holds no schedule, so the trigger is a TODO; a snapshot carries it.
- A router becomes an all-matching `path/branch`, one path per route, each guarded by the filter on the route's first module. The fallback route runs only when no other route matched; a route with no filter always runs.
- An If-else becomes a first-match `path/branch` whose else branch is the fallback, and the flow continues after it where Make merges the branches. A Merge that picks a different value per branch has no equivalent and is a TODO.
- A filter between two modules gates what follows it. A filter mixing AND and OR groups that no single condition says is a TODO.
- An Iterator becomes a `loop/each` over its array, running the modules up to its aggregator; an array aggregator follows the loop and collects its items as a list; a text aggregator is a TODO. A Sleep of a fixed number of seconds becomes a `delay/wait`.
- `{{1.email}}` becomes `{{trigger.data.body.email}}` when module 1 is a webhook trigger (the webhook's payload is under `body`), `{{trigger.data.email}}` when it is another trigger, and `{{<step>.result.email}}` otherwise; IML functions such as `formatDate` and `length` become template helpers.
- The Slack, Gmail, HubSpot and GitHub modules that create a message, an email, a contact or an issue become connection calls; Airtable modules on the base you are migrating become `record` steps.
- An error handler, such as Break, has no exact equivalent: it is a TODO after the module it guards. A code module, or a module of an app with no mapping and no connection, is a TODO quoting its settings. A module's connection id only tells two connections apart; it is never copied.

## Baserow workflows

A Baserow workspace export ZIP carries its workflows, and each becomes a disabled automation. A trigger on created, updated or deleted rows becomes a record trigger on the imported table. Row actions and router conditions are Baserow formulas, so they are kept as TODOs quoting them; the router's paths and its default path are kept. A database token cannot read workflows, so a `baserow:` fetch imports none.

## Webflow form webhooks

Webflow switched Logic off in June 2025, so a site's only automation is a webhook that fires when a form is submitted. The `webflow:<siteId>` fetch reads the webhooks when its token has the `sites:read` scope; without it the report names the scope to add and imports the rest. Each `form_submission` webhook becomes a disabled automation:

- its trigger is the imported form the webhook was filtered to, or a TODO naming the form when that form was not imported with it;
- its one step sends each submission to the address the webhook called, in the shape Webflow sent it (`triggerType`, then the form's name, site, id and answers), so the service it fed keeps working;
- that address is a credential, so the step reads it from `$env.WEBFLOW_WEBHOOK_<FORM>_URL` (numbered when a form has several webhooks), the import declares the variable, and the report tells you to set it, quoting only the address's host.

Once you switch it on, the integration fires from Sovrium. **Delete the webhook in Webflow then**, or each submission arrives twice; the report reminds you, naming the destination's host. Other webhook types, such as a site publish or a CMS item change, have no Sovrium trigger and are listed as not importable, as is Logic. Webflow's API lists the webhooks apps created; one added in the site settings may be missing, so check that page too.

## Retool Workflows

Retool's API never returns a workflow's blocks, so a Retool workflow is read from the file the workflow editor writes: open it, choose **•••** then **Export to JSON**, and give that file to `sovrium import`. It is recognised by its shape, or named with `--from retool-workflows`.

```bash
sovrium import ./lead-intake.json --config app.yaml --write
```

- The start block becomes the trigger: a webhook start becomes a `webhook` trigger, a schedule keeps its cron expression and time zone, and any other start is manual. A workflow with both a webhook and a schedule keeps the webhook.
- A JavaScript or Python block becomes a code stub keeping its code as comments.
- A Branch becomes a first-match `path/branch`, read from the conditions you wrote in the block, never from the JavaScript Retool generates from them. A plain comparison such as `lookup.data.seats >= 50`, or several joined by `&&` alone or `||` alone, translates; any other statement, including an empty one, is left out of the path's condition and listed as a TODO. The else branch runs when no other one matched.
- A REST request becomes `http/request` with its method, headers and body; a credential header is left out, and an address that is a credential, such as a Slack incoming webhook, moves to an environment variable.
- `{{ lookup.data.email }}` becomes `{{lookup.result.email}}`, and a read of the start block's data becomes `{{trigger.data.body.…}}` on a webhook; any other JavaScript inside braces is a TODO.
- A Loop becomes a `loop/each` over its input; the code it runs for each item is not read. A Response block becomes the webhook's reply, with its body; its status is not carried over.
- A SQL query, or any other query that runs against a Retool resource, is a TODO quoting it: an export never includes resources, so the report names the resource to connect to Sovrium. A Workflow block, an AI block and anything else Retool adds is a TODO too.

## Zapier

A Zap is read from the `Zapfile.json` in the ZIP that **Settings › Data management › Export my data** emails you (the ZIP itself is accepted, and only `Zapfile.json` is read from it), from the JSON that the Zaps list's **Export Zaps** downloads, or from one-Zap JSON files, such as an archive of Zaps read from Zapier's API. Pass one file, or a folder of them. Zapier has no API a command-line tool can read Zaps with, so there is no `zapier:` fetch.

```bash
sovrium import ./Zapfile.json --config app.yaml --write
sovrium import ./zaps/ --from zapier --config app.yaml --write
```

- **Every Zap lands disabled**, whether it was on in Zapier or not; the report says which were on.
- A Catch Hook becomes a `webhook` trigger. A Schedule trigger becomes `cron` when the export states its time, weekday or day of month; otherwise it is a TODO. A Typeform, Jotform or Webflow form trigger becomes a `webhook` trigger you point the form tool at, a lemlist activity trigger a `webhook` you register in lemlist, and an Airtable new or updated record trigger is a TODO naming its table, because neither the form nor the base is imported with the Zap.
- Paths become an all-matching `path/branch`, one path per Zapier path in order, each guarded by its rules. A Filter stops the run when its rules fail. Rules combining AND and OR groups, and comparisons with no exact Sovrium equivalent, are TODOs.
- `{{<step id>__<field>}}` becomes `{{trigger.data.<field>}}` for the trigger and `{{<step>.result.<field>}}` otherwise.
- Slack channel messages, HubSpot contacts, Gmail and Outlook sends, and Google Drive uploads and shares become connection calls, with the connection and the names of its variables added. A Salesforce find, or find by query, becomes a Salesforce SOQL query, written from the object and field or clause the Zap searched. Looping by Zapier becomes `loop/each`, its body the steps under it. Webhooks by Zapier POST, GET, PUT and custom requests become `http/request`, and a catch-hook address moves to an environment variable. A Delay becomes `delay/wait`. Code by Zapier becomes a TypeScript stub keeping the code as comments.
- An Airtable record step and a call to another Zap name the Sovrium action they become, and are kept as TODOs. So are a Salesforce record creation (the Lead or Opportunity call to pick) and a Google Docs template (`document/generateDocx` from the template as `.docx`). A Dropbox upload and a Mailjet template send are typed calls of their library connection (the template stays in Mailjet), a Google Sheets row is a typed call of the google-sheets library connection's `append-sheet-values`, and a pdfFiller template an `http/request` on the pdfFiller connection. A Gmail search trigger starts by hand, with a TODO to rebuild it as a `cron` that lists the messages. A Formatter step is a TODO unless its transform has an exact equivalent; one whose transform is not in the export names what its family's transforms become. A Zap started from Zapier's Chrome extension starts by hand, and one started by a Mailparser email starts from a `webhook` trigger to point Mailparser at, each with a TODO. A step of an app with no mapping that runs on no Zapier connection is a TODO quoting its settings.
- **A one-Zap API file carries no step inputs.** It lists its steps as `steps` or `nodes`; when each step names its parent, the Zap is read as a tree exactly like an export file, so its Paths keep their branches. Each step still becomes the action or connection call it maps to, or a stub naming it, and every input is reported as not in the export; a connection call's required inputs are `{{todo.<name>}}` placeholders. Steps on the same Zapier connection share one Sovrium connection across every Zap of the folder. A step whose app the file does not name is kept as a TODO saying so, and a Zap whose trigger names no app is kept too: it starts by hand, with a TODO saying the export names no app for its trigger. You keep the full shape of each Zap and fill in the values.
- No Zap is dropped silently: a file that holds no Zap, an entry of a list that is not one, and a Zap with no step each get a line in the report.
- Zapier connections never travel with an export: reconnect each app, setting the variables the report lists. A Zapier Tables table imports from its CSV download (see [Migrating Tables and Records](/en/docs/cli-import-tables)).
