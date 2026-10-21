# Migrate from n8n to Sovrium

> Move n8n workflows to Sovrium automations with `sovrium import`: fetch every workflow of an instance or convert an export file, rewrite the code steps the report lists, then switch the automations on one at a time.

An n8n workflow is a trigger node followed by nodes, IFs and loops. A Sovrium automation is the same graph, declared in config next to the tables it works on, and run by the same server as your app. `sovrium import` converts each workflow into an automation written **disabled**, with a TODO list for what it could not translate.

## Before you start

You need an app to import into. If your workflows read and write an Airtable base, import the base first with [Migrate from Airtable to Sovrium](/en/docs/migrate-from-airtable): the workflows' Airtable nodes then become record steps on the imported tables.

In n8n, create an API key under **Settings › n8n API** (n8n's Cloud trial does not offer one). On a self-hosted instance you can instead export the workflows to a file with `n8n export:workflow`, which needs no key.

## 1. Fetch the workflows

```bash
export N8N_API_KEY=…
sovrium import fetch n8n:https://acme.app.n8n.cloud --out .sovrium-imports/n8n
```

The fetch reads every workflow, sending only `GET` requests. It never reads n8n's credentials: a workflow names the credentials its nodes use, never their values. The instance must be reached over `https`, except on your own machine.

## 2. Preview and read the report

```bash
sovrium import .sovrium-imports/n8n --config app.yaml
```

The dry run writes nothing. Each workflow is listed with its TODO count, and the workflows that were active in n8n are marked:

```text
Automations (3, every one disabled):
  + new-lead-triage (from "New lead triage", on in the source): 4 TODOs
  + nightly-invoice-export (from "Nightly invoice export"): 1 TODO
  + manual-cleanup (from "Manual cleanup"): 1 TODO

Simplified or left out (1):
  New lead triage › Discard: A no-op node does nothing; it is dropped

TODO (6):
  automations.new-lead-triage.actions.score_lead: A code step is kept as a stub; its code is never translated.
      const lead = $input.item.json.body;
      return { json: { ...lead, score: lead.seats * 10 } };
  automations.nightly-invoice-export.actions.sum_totals: A code step is kept as a stub; its code is never translated.
      total = sum(item['json']['amount'] for item in _items)
      return [{'json': {'total': total}}]
```

Webhook, schedule and manual triggers, HTTP requests, IF, Switch, Filter, Loop Over Items and Wait nodes all have a Sovrium equivalent, and so do the app nodes that name their operation: each becomes a typed call on a connection shared across the import, a required input the node does not give written as a `{{todo.<name>}}` placeholder. Expressions such as `{{ $json.body.email }}` are rewritten to `{{trigger.data.body.email}}`. A Code node, in JavaScript or Python, becomes a TypeScript stub that keeps the original as comments; a node with no mapping becomes the same kind of stub, quoting its settings. The full mapping is in [Migrating Automations](/en/docs/cli-import-automations).

## 3. Write

```bash
sovrium import .sovrium-imports/n8n --config app.yaml --write
```

The automations are added to `app.yaml` with `enabled: false`. A connection the import added declares the environment variable its token reads, and a webhook address that is itself a credential, such as another n8n instance's webhook, moves to an environment variable. The report lists every variable to set.

## 4. Finish each automation

Work through the TODO list one automation at a time: rewrite each code stub in TypeScript, replace each unmapped node with a Sovrium action, give each loop the list it walks, replace each `{{todo.<name>}}` placeholder with its value, and set the variables the report lists. `sovrium validate` refuses an automation switched on while a placeholder is left.

## 5. Switch them on one at a time

Change `enabled: false` to `enabled: true` on one automation, start the app, and check its runs under `/_admin/runs`:

```bash
sovrium start app.yaml
```

Once it behaves, deactivate the workflow in n8n and move to the next one, so no event is handled twice. A workflow that started on an n8n webhook gets a new address as a Sovrium `webhook` trigger: point its callers at it.

## What does not come across

- **Credentials**: their values never leave n8n. Authorise each Sovrium connection yourself.
- **Code**: JavaScript and Python are never translated, only kept as comments for you to rewrite.
- **Pinned sample data** is not read.
- **Archived workflows** are imported like the others, and the report marks them, so you can delete what you no longer want.
