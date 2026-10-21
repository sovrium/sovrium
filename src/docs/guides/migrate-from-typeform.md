# Migrate from Typeform to Sovrium

> Move a Typeform form and its responses to a self-hosted Sovrium form with `sovrium import`: fetch it read-only, preview the conversion, read the report, then write and seed the form, its logic and its past responses.

A Typeform form becomes a Sovrium form that writes each submission to a table of its own. `sovrium import` brings the questions, the pages, the logic jumps, the hidden fields, the score and the thank-you screen, and the past responses become the records of that table.

## Before you start

You need an app to import into; an empty one is enough:

```yaml
name: surveys
version: 1.0.0
```

In Typeform, create a personal access token in your account settings with the `forms:read` and `responses:read` scopes. Copy the form's id from its link. An account on Typeform's EU data centre names it in the source: `typeform:api.eu.typeform.com/<formId>`.

## 1. Fetch a snapshot

```bash
export TYPEFORM_TOKEN=tfp_…
sovrium import fetch typeform:abc123XY --out .sovrium-imports/survey
```

The fetch reads the form's definition, every response, and every uploaded file, sending your token only to Typeform's own host. It only reads.

## 2. Preview and read the report

```bash
sovrium import .sovrium-imports/survey --config app.yaml
```

The dry run writes nothing. The report shows the form, its responses table and what did not translate:

```text
Tables (1):
  + where_do_you_live_responses (23 fields, from Where do you live?)
    as text where_do_you_live_responses.rank_these_cities: ranking -> long-text — No Sovrium form field answers a typeform "ranking" question; each answer is kept as text.

Records (1 seed file):
  seed/import/where_do_you_live_responses.yaml: 4 records, keyed by source id

Forms (1):
  + where-do-you-live (from "Where do you live?", writes to where_do_you_live_responses): 18 fields, 3 steps, 4 responses

TODO (2):
  forms.where-do-you-live.fields.do_you_plan_to_stay: The form ends here as in the source, but the source showed another thank-you screen on this path; a Sovrium form shows one success message.
  forms.where-do-you-live.fields.score: The typeform calculation of "score" depends on conditions or on another variable, which a Sovrium calculation cannot express; the values the source computed are kept in its column.
```

Pages become the steps of a multi-step form, forward logic jumps become rules showing each question only when no jump skips it, hidden fields are filled from the form's link, and an unconditional score becomes a calculation. A ranking question keeps each answer as text. A jump back, a conditional score or a second thank-you screen is a TODO, quoted as Typeform wrote it. The full mapping is in [Migrating Forms](/en/docs/cli-import-forms).

## 3. Write and seed

```bash
sovrium import .sovrium-imports/survey --config app.yaml --write --apply
sovrium start app.yaml
```

`--write` adds the form and its responses table to `app.yaml` and the responses to the gitignored `seed/import/`; `--apply` seeds them. The form is served at `/forms/where-do-you-live`, and its past responses are records of `where_do_you_live_responses`, alongside the ones it receives from now on. Running the import again changes nothing.

## 4. Switch over

Work through the TODO list, try the form yourself, then replace the Typeform link or embed on your site with the Sovrium form's address. Keep the Typeform form open until the new one has received its first real responses.

## What does not come across

- **Design**: themes, images and layouts; the form takes your app's design.
- **A second thank-you screen**: a Sovrium form shows one success message.
- **Ranking, matrix and payment questions** keep their answers as text and are not fields of the new form.
- **Integrations and webhooks** Typeform sent responses to: rebuild them as automations on the form.
