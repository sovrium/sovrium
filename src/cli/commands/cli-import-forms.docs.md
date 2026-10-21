# Migrating Forms

> Bring a Typeform, Tally, Fillout or Webflow form across with its past responses: the questions, pages, branching, hidden fields and thank-you screen each tool exposes, and a report of what it keeps to itself.

Every form source follows the two stages of [Migrating From Another Tool](/en/docs/cli-import). Each form becomes a `forms[]` entry that writes to a table of its own, `<form>_responses`: one column per question, plus `source_id`. The form's fields are `table-field` entries naming those columns, so a submission is validated and stored like any record. Its past responses become the records of that table, in `seed/import/<form>_responses.yaml`, keyed by the response's id, and `--apply` seeds them like any other import.

## The sources at a glance

| Source          | How to get it                                                                                 | What maps                                                                         | What degrades                                                           | What is reported                            |
| --------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| Typeform        | `typeform:[<host>/]<formId>`, a personal access token in `TYPEFORM_TOKEN`; or the form's JSON | questions, pages, logic jumps, hidden fields, the score, thank-you screens, files | a conditional score keeps its computed values                           | ranking questions, extra thank-you screens  |
| Tally           | `tally:<formId>`, an API key in `TALLY_TOKEN`; or the form's JSON                             | blocks, pages, hidden and calculated fields, conditional logic                    | a conditional calculation keeps its computed values                     | questions with no Sovrium field             |
| Fillout         | `fillout:[eu/]<formId>`, an API key in `FILLOUT_TOKEN`; or the form's JSON                    | questions, choices, URL parameters, the calculations' results                     | one page, no rules: the API gives no pages, logic or required answers   | that the form was imported flat             |
| Webflow forms   | `webflow:<siteId>`, a site token holding `forms:read`                                         | text, email, phone and number fields, submissions, the redirect                   | one page of fields: the API gives no required flag, options or logic    | password fields, answers to removed fields  |
| Jotform         | `jotform:[eu/\|hipaa/]<formId>`, an API key in `JOTFORM_API_KEY`                              | questions, page breaks, hidden fields, the thank-you page, files                  | calculated fields keep their computed values                            | every condition, as a TODO; widgets         |
| Google Forms    | `gforms:<formId>`, an OAuth access token in `GOOGLE_TOKEN`                                    | sections, questions, grids, go-to-section by answer                               | uploaded files are kept as names and Drive ids                          | section-level jumps, quiz grading           |
| Microsoft Forms | the responses workbook, with `--from microsoft-forms`                                         | one column per question, typed from its answers                                   | question types, choices, sections and branching are not in the workbook | that the form was inferred from its columns |

Jotform, Google Forms and Microsoft Forms are detailed in [Migrating Forms From Jotform, Google Forms and Microsoft Forms](/en/docs/cli-import-forms-more).

## What a form becomes

- **Questions** map through one table per tool: short and long text, email, number, phone, website, date, a choice (a select listing the choices, then any other answer a response gave), several choices (a multi-select), yes/no and consent (a checkbox), a scale (an integer), a rating (keeping its scale), a file upload (an attachment). A ranking, a matrix, a payment, an address or any other question with no Sovrium field keeps each answer as text, and the report names it. A signature keeps its image as a file; the signer and the statement are not in any export.
- **Pages and groups** become the steps of a multi-step form. A statement or a heading becomes a section.
- **Branching** becomes visibility. A jump skips the questions between its question and its target, so each skipped question is shown only when no jump that would skip it is taken. That holds when every jump of a question goes forward; a jump back, or one on a comparison with no opposite, is a TODO quoting it, and none of that question's jumps is converted. A rule showing, hiding or requiring a question becomes its `visibleWhen` or `requiredWhen`.
- **Hidden fields** become hidden fields filled from the link: `prefill` reads `$query.<name>`, and the values each response carried are kept in their columns.
- **Scores and calculated fields** become a column holding the values the tool computed. One whose every step applies unconditionally also becomes a `calculation` field; a conditional score, such as "add 2 when the answer is Barcelona", is a TODO quoting its rules.
- **The thank-you screen** becomes `onSuccess`: its heading and text, or its redirect. A path that ends on another thank-you screen is a TODO, since a Sovrium form shows one.
- **An answer to a question the form no longer has** is kept in a column of its own, and the report says it is not a field of the form.

## Typeform

```bash
export TYPEFORM_TOKEN=tfp_…
sovrium import fetch typeform:abc123XY
sovrium import .sovrium-imports/typeform-… --config app.yaml --write --apply
```

`typeform:<formId>` takes the id from the form's link. Create a personal access token in your Typeform account settings with the `forms:read` and `responses:read` scopes. The definition carries the logic, the hidden fields and the score; uploaded files are downloaded with your token, which travels only to Typeform's own host. An EU account names its data centre: `typeform:api.eu.typeform.com/<formId>`.

## Tally

```bash
export TALLY_TOKEN=tly-…
sovrium import fetch tally:wMb1aB
```

`tally:<formId>` takes the id from the form's link. Create the key under **Settings › API keys**; Tally's API is open on its free plan. Tally's blocks carry the pages, the hidden and calculated fields and the conditional logic. A Tally key carries every right of its owner and has no scopes, so the fetch never relies on it to stay read-only: it only ever reads.

## Fillout

```bash
export FILLOUT_TOKEN=…
sovrium import fetch fillout:abc123
```

`fillout:<formId>` takes the form's id; `fillout:eu/<formId>` reads an account on Fillout's EU servers. The key comes from the **Developer** settings. Fillout's API gives the questions, their choices, the URL parameters and the calculations' results, but no pages, no logic, no required answers and no formulas: a Fillout form is imported as one page with no rules, and the report says so. Set the rest by hand after the import.

## Webflow forms

The `webflow:<siteId>` fetch that reads a site's CMS collections also reads its forms and their submissions when the site token has the `forms:read` scope. A token without it does not fail the fetch: the report names the scope to add, and the rest is imported.

- **Fields** keep their type: text, email, phone and number. Webflow's API states no required flag, no options and no conditional logic, so the form is one page of fields, and the report says to set the rest by hand.
- **A password field is never imported**, nor any answer it received.
- Every submission becomes a record of the form's responses table, keyed by its id. **An answer to a field the form no longer has** is kept in a column of its own.
- The redirect the form sent people to after submitting becomes its `onSuccess`.

A site's form webhooks become automations: see [Migrating Automations](/en/docs/cli-import-automations).
