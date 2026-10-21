# Migrating Forms From Jotform, Google Forms and Microsoft Forms

> Bring a Jotform or Google Forms form and its responses across with one read-only fetch, or a Microsoft Forms form from its responses workbook. What each tool keeps to itself is reported, never guessed.

These three sources follow the same path as the other form builders in [Migrating Forms](/en/docs/cli-import-forms): each form becomes a `forms[]` entry writing to its own `<form>_responses` table, its past responses become the records of that table in `seed/import/`, and `--apply` seeds them. This page says what each of the three exposes, and what becomes of it.

| Source URI                      | Reads                              | Token from                              |
| ------------------------------- | ---------------------------------- | --------------------------------------- |
| `jotform:[eu/\|hipaa/]<formId>` | a Jotform form and its submissions | `JOTFORM_API_KEY`                       |
| `gforms:<formId>`               | a Google form and its responses    | `GOOGLE_TOKEN` (an OAuth access token)  |
| a responses workbook (`.xlsx`)  | a Microsoft Forms form's responses | none: `--from microsoft-forms`, offline |

```bash
export JOTFORM_API_KEY=…
sovrium import fetch jotform:241000000000001
sovrium import .sovrium-imports/jotform-… --config app.yaml --write --apply

sovrium import ./Workshop-sign-up.xlsx --from microsoft-forms --config app.yaml --write
```

## Jotform

`jotform:<formId>` reads the form, its questions, its properties and its submissions through Jotform's REST API, with your API key in the `APIKEY` header. Submissions are read 1,000 at a time, and each uploaded file or signature is downloaded during the fetch.

- **Only `GET` requests are sent.** A Jotform key created with read access can still change a form's settings, so the fetch never relies on the key's level to stay read-only.
- **Your account's server is found for you.** An account on Jotform's EU servers asked on the US host is answered with the EU host, and the fetch reads the form again from there. Write `jotform:eu/<formId>` or `jotform:hipaa/<formId>` to go there directly. The key is only ever sent to a Jotform host.
- **The daily API limit stops the fetch.** Jotform counts calls per day (1,000 on the free plan) and resets the count at midnight US Eastern time. When it is used up, the fetch stops at once with a message saying so, instead of waiting for hours; run the same command after the reset and it resumes where it stopped.

What the form becomes:

- **Questions** map through Jotform's row of the question table. A choice question lists its options, a full name or an address is kept as one text, a date becomes a date. A page break starts the next step. A matrix, a payment or any widget is kept as text, one answer per response, and reported; a widget is also a TODO, since the API exposes none of its settings.
- **A hidden field** becomes a hidden field filled from the link.
- **Conditions are reported, not converted.** Jotform keeps its conditions as form settings: each one, whether it shows a field, skips to a page or calculates a value, is a TODO quoting its terms and actions, so you recreate it as a `visibleWhen`, a step's `goToWhen` or a `calculation`. No visibility rule or formula is invented.
- **A calculated field** is not something the respondent typed: it becomes a column named after the field's Jotform name, holding every value Jotform computed, and it is not a field of the form.
- **The thank-you page** becomes `onSuccess`: its text, or the page it redirected to.

## Google Forms

`gforms:<formId>` reads the form (`forms.get`) and its responses (`forms.responses.list`) through the Google Forms API, with an OAuth access token in `GOOGLE_TOKEN`. The token needs the `forms.body.readonly` and `forms.responses.readonly` scopes, and nothing more. Only `GET` requests are sent.

- **Sections** become the steps of a multi-step form, the questions before the first section break being the first step. A text, an image or a video item becomes a section heading.
- **Questions** map through the Google Forms row of the question table: a paragraph becomes long text, a date asking the time a date-time, a checkbox question a multi-select, a scale an integer, a rating a rating. Each row of a grid becomes a choice question of its own, its choices the grid's columns. An email the form collects becomes the form's first field.
- **"Go to section based on answer"** becomes the step's `goToWhen`: when the respondent leaves the section on that answer, the step for the target section follows. That holds when the jump goes forward. An option that submits the form at once, or restarts it, is a TODO quoting it.
- **A section's own "after this section, go to" setting is not in the API.** The sections are imported in document order, so a respondent who finishes one section goes on to the next; the report says this as a TODO for every form with sections, so you can check where the original jumped.
- **Quiz grading** has no Sovrium equivalent: the correct answers, points and feedback are reported, and each response keeps its total score in a `total_score` column.
- **Uploaded files** are Google Drive files, read through another API with another scope, so they are not downloaded: each answer keeps the file names and their Drive ids as text, and the report says so.

## Microsoft Forms

Microsoft Forms has no API a migration can read and no export of the form itself. What it gives is the responses workbook: open the form's responses, choose **Open results in Excel**, and download the file. Name the tool with `--from microsoft-forms`; the CSV of that sheet is read the same way.

- **The form is inferred from the columns**, and the report says so. The leading columns naming the response details (the response id, the start and completion times, the email and the name) become columns of the responses table, not form fields. Their headers are matched loosely, in the export's common languages, and the report lists the ones it recognised. An anonymous response keeps no email.
- **Every other column is a question**, titled by its header and typed from its answers, the same way a spreadsheet column is: numbers, dates, emails, links and text. A column whose answers are lists closed by `;` is a multiple choice. The question types, choice lists, required answers, sections and branching are not in the workbook: review the form after the import.
- **A quiz** keeps its total points, its feedback and each question's points and feedback as columns; the grading itself is reported.
- The response id keys each record, so importing a newer workbook updates the same rows and adds the new ones.
