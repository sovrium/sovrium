# Migrate from Make to Sovrium

> Move Make scenarios to self-hosted Sovrium automations with `sovrium import`: fetch a team's scenarios or convert a blueprint file, read the TODO list, then switch the automations on one at a time.

A Make scenario is a trigger module followed by modules, routers and filters. A Sovrium automation has the same shape, declared in config and run on your own server, with no operation limits. `sovrium import` converts each scenario into an automation written **disabled**, so nothing runs until you have checked it.

## Before you start

You need an app to import into, usually the one holding the tables your scenarios read and write. If those tables live in Airtable, import them first with [Migrate from Airtable to Sovrium](/en/docs/migrate-from-airtable): a scenario's Airtable modules then become record steps on the imported tables.

Create a Make API token with the `scenarios:read` scope. Note your zone, the start of your Make dashboard's host (`eu1`, `eu2`, `us1`, `us2`), and the id of your team.

## 1. Fetch the scenarios

```bash
export MAKE_TOKEN=…
sovrium import fetch make:eu1/123456 --out .sovrium-imports/make
```

The fetch lists the team's scenarios and reads each blueprint, sending only `GET` requests. To convert one scenario without a token, open it in the scenario editor, choose **Export blueprint**, and convert that file instead: it carries the modules but not the schedule.

## 2. Preview and read the report

```bash
sovrium import .sovrium-imports/make --config app.yaml
```

The dry run writes nothing. Each scenario is listed with its TODO count, and the scenarios that were switched on in Make are marked:

```text
Automations (2, every one disabled):
  + lead-routing (from "Lead routing", on in the source): 2 TODOs
  + weekly-digest (from "Weekly digest"): ready to review

TODO (2):
  automations.lead-routing.actions.builtin_break_error_handler_of_http_action_send_data: Sovrium has no step for Make's Error Handler module "break" (onerror:builtin:Break) yet; it is kept as a stub to rebuild.
  automations.lead-routing.actions.util_text_aggregator: Sovrium has no step for Make's Tools module "text aggregator" (util:TextAggregator) yet; it is kept as a stub to rebuild.
```

Webhooks, schedules, routers, If-else, filters, iterators, array aggregators and sleeps all have a Sovrium equivalent, and so do the Slack, Gmail, HubSpot and GitHub modules that create a message, an email, a contact or an issue. An error handler, a text aggregator, a code module or a module of an app with no Sovrium connection becomes a TODO: a TypeScript stub in the step's place, quoting its settings. The full mapping is in [Migrating Automations](/en/docs/cli-import-automations).

## 3. Write

```bash
sovrium import .sovrium-imports/make --config app.yaml --write
```

The automations are added to `app.yaml` with `enabled: false`. A connection the import added declares the environment variable its token reads, and a Make or Zapier webhook address a step called moves to an environment variable too, because anyone holding it can call it. The report lists every variable to set.

## 4. Finish each automation

Work through the TODO list one automation at a time:

- rewrite each stub in TypeScript, or replace it with a Sovrium action;
- check each reference to the trigger: a webhook delivers its payload at `{{trigger.data.body.…}}`, which the import writes for a webhook module's fields, so look at references the import kept as TODOs;
- replace each `{{todo.<name>}}` placeholder with its value, since `sovrium validate` refuses an automation switched on while one is left;
- set the variables the report lists;
- give a scenario that came from a blueprint file its schedule, as a `cron` trigger.

## 5. Switch them on one at a time

Change `enabled: false` to `enabled: true` on one automation, start the app, and check its runs under `/_admin/runs`:

```bash
sovrium start app.yaml
```

Once it behaves, turn the scenario off in Make, then move to the next one, so no event is handled twice. A scenario that received a Make webhook gets a new address as a Sovrium `webhook` trigger: point its callers at it.

## What does not come across

- **Connections and their credentials**: connection ids are never copied; authorise each Sovrium connection yourself.
- **Error handlers** such as Break have no exact equivalent: each is a TODO after the module it guarded.
- **Data stores** and the modules of apps with no Sovrium connection: call the service with an `http` action, or keep the data in a Sovrium table.
