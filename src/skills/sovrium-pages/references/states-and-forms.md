# States, forms and dark mode

A page is not finished when its happy path renders. Every data component has a life before
data arrives, when there is none, when fetching fails and when the visitor may not see it.
Every form has a life after the visitor makes a mistake. This file is the checklist for both,
plus dark mode, which fails in its own specific ways.

## Contents

- [Empty states](#empty-states)
- [Loading](#loading)
- [Errors](#errors)
- [Success and confirmation](#success-and-confirmation)
- [Forms: layout](#forms-layout)
- [Forms: required and optional](#forms-required-and-optional)
- [Forms: validation](#forms-validation)
- [Forms: choosing a control](#forms-choosing-a-control)
- [Dark mode](#dark-mode)

## Empty states

Every data component (`table`, `list`, `kanban`, `calendar`, `gallery`, `chart`, `kpi`,
`matrix`, `graph`) declares what it shows when there is nothing to show. The platform's default
is a fallback, not a design.

Name which of the four empty cases applies, because each needs different words:

| Case          | Why it is empty                        | What the state says                                   | The one action                          |
| ------------- | -------------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| First use     | Nothing has been created yet           | What this area is for, in one line                    | Create the first item, or import        |
| No results    | A search or filter excluded everything | That nothing matched, echoing the query               | Clear the filter, or broaden the search |
| Error         | The data could not be loaded           | What failed, in plain words                           | Retry                                   |
| No permission | The visitor may not see this           | That access is restricted, not that the area is empty | Who to ask, or where to go instead      |

- Every empty state carries exactly one next action. A bare "No data" is a dead end.
- Keep no-results distinct from first-use: telling a searcher "create your first record" misreads what happened. Tables separate the two (`emptyMessage` and `noMatchMessage`): `sovrium docs data-components/data-components`.
- A permission-denied area that may reveal existence says "restricted", never "empty"; where existence itself is sensitive, the page is not shown at all.
- Use the `empty-state` component for standalone empty areas; its keys carry an `empty` prefix, and a misspelled key is dropped silently: `sovrium docs components/display-components`.
- An illustration is optional and never replaces the sentence and the action.
- First-use empty states may teach one thing (what an item is), never a tour.
- The words follow `design.voice.tone.empty` when the app declares it (see `copy.md`).

## Loading

Choose the indicator by how long the wait usually is, measured, not guessed.

| Typical wait                      | Indicator                                                    | Sovrium component           |
| --------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Under 1 s                         | None. An indicator that flashes is worse than none           | —                           |
| 1–2 s                             | None, or a subtle inline indicator on the triggering control | `spinner` inside the button |
| 2–10 s, one module                | A looping indicator in place of the module                   | `spinner`                   |
| 2–10 s, full page or large region | A skeleton that mirrors the final layout                     | `skeleton`                  |
| Over 10 s                         | Determinate progress: percentage or steps, plus an estimate  | `progress`                  |

- A skeleton mirrors the real layout (same blocks, same positions), so nothing jumps when data arrives.
- Never show a skeleton for content that will not appear; it promises something.
- Reserve the space of content that loads late (images, embeds) so the layout does not shift.
- A long task says how long it will take and, if the work continues without the visitor, that they may leave.
- Disable a submit control while its request is in flight, and keep its label; do not replace the label with a spinner alone.
- Feedback components: `sovrium docs components/feedback-components`.
- The words follow `design.voice.tone.loading`.

## Errors

- Say what happened, why if it is known, and what to do next — three parts, in that order, in plain language.
- Place the message next to its source: a field error under the field, a request error at the component that made the request, a page error at the top of the page.
- Never rely on colour alone. Pair the error colour with text and an icon or a prefix such as "Error:".
- Never blame the visitor; state the constraint ("Use 8 or more characters"), not the fault ("Invalid password").
- Never show raw codes, stack traces or internal identifiers as the message; a code may follow the sentence for support.
- Keep what the visitor typed. An error that clears the form punishes them twice.
- Offer the fix when the system knows it (trim, reformat, retry).
- Errors are the one place chrome spends the error colour, so it keeps its meaning.
- The words follow `design.voice.tone.error`.

## Success and confirmation

- Confirm success in one short line, near where the action happened. No celebration.
- Use a `toast` for success that does not change the page, and only for that; never put an error the visitor must act on in a toast that disappears.
- Destructive actions confirm first in an `alert-dialog`. The confirmation names what will be lost, how many, and whether it can be undone; the confirm button repeats the verb ("Delete 12 records"), never "OK".
- Prefer undo over confirmation for actions that can be reversed.
- The words follow `design.voice.tone.success` and `design.voice.tone.destructive`.
- Overlay components: `sovrium docs components/overlay-components`.

## Forms: layout

- One column. Multi-column forms cause skipped fields and zig-zag reading.
- Labels above the field, not beside it and never only inside it: a placeholder disappears the moment typing starts and is not a label.
- Group related fields under a short heading; keep a group to a handful of fields.
- Size a field to its expected content (a postcode field is short).
- Put the primary submit at the end of the form, aligned with the fields, and label it with its outcome ("Create account"), not "Submit".
- Keep secondary actions ("Cancel") visibly quieter than the primary one.
- Ask only for what the task needs now. Every optional field is a reason to leave.
- Form model and fields: `sovrium docs forms/forms-overview` and `sovrium docs forms/form-fields`.

## Forms: required and optional

The right marking depends on the form. Pick the case, then apply it consistently:

| The form's fields are…          | Mark                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| All required                    | Say so once above the form; no per-field markers                                          |
| Mostly required, a few optional | Mark the optional ones with the word "(optional)"                                         |
| Mostly optional, a few required | Mark the required ones with the word "(required)" or an asterisk explained above the form |

- When in doubt, mark both explicitly; visitors do not reliably infer the unmarked case.
- An asterisk is never the only cue: explain it once at the top of the form, and make sure assistive technology hears "required" (the field's required state, not the glyph).
- Conditional requirements (`requiredWhen`) show the marker only when the condition holds.

## Forms: validation

- Validate a field when the visitor leaves it, not on every keystroke, and never before they have typed.
- Clear a field's error as soon as the value becomes valid.
- On submit, validate everything. For a long form, show a summary at the top listing each error as a link to its field, and keep each inline message beside its field.
- Move focus to the summary (or to the first invalid field on a short form) after a failed submit.
- Be tolerant of format: accept spaces in phone and card numbers, any case in codes, and a trailing space anywhere. Normalise on the server rather than refusing the visitor.
- Give examples for formatted input in the hint ("For example, 12 March 2026"), not only in the placeholder.
- Validate on the server as well, always. Client-side checks are a courtesy; the server's answer is the truth, and its messages must map back to the fields.
- Never ask for the same information twice in one flow; carry it forward.

## Forms: choosing a control

- Five options or fewer, one choice: a `radio-group`, or a `toggle-group` for a compact segmented control. Every option is visible without opening anything.
- More than five options, one choice: a `select`; with many options or unfamiliar values, a searchable picker.
- Several choices from a short list: checkboxes. From a long list: a multi-select with search.
- A binary setting that applies immediately: a `switch`. A binary answer submitted with the form: a checkbox.
- Dates: a date picker that also accepts typed input.
- A choice between records in another table: `record-picker`, never a free text field.
- A number with small steps: `number-input` or a slider only when the exact value does not matter.
- Controls and their options: `sovrium docs form-controls/form-controls` and `sovrium docs form-controls/specialty-components`.

## Dark mode

Light is the default scheme unless the app's `design.colorScheme` says otherwise. For most
readers with typical vision, dark text on a light background reads faster and more accurately;
dark mode is a preference to honour, not the baseline to design in.

- Design in light first, then check every page in dark; never ship a dark-only theme.
- Respect the visitor's system preference when `design.colorScheme` is `system`, and offer a `theme-toggle` where the app does.
- Use the app's `design.darkColors` overrides through the same colour roles; never swap colours per component.
- Scheme options: `sovrium docs theming/theme-dark-mode`.

The dark-mode QA pass checks these known failures on every page:

- **Images and marks**: a logo or diagram drawn for a light background disappears on a dark one. Use the logo's dark-mode variant (`design.logo.srcDark`) and check every diagram and screenshot.
- **Elevation**: shadows are invisible on dark surfaces. Raised surfaces need a lighter surface colour, not a darker shadow.
- **Dividers and borders**: too bright and they cage the content; too dim and grouping disappears. Check both tables and forms.
- **Saturated accents**: fully saturated colours vibrate on dark backgrounds. Use the desaturated dark variant of the role.
- **Pure black**: large pure-black areas with pure-white text cause halation; use the scheme's dark surface and foreground roles.
- **Contrast**: re-run the contrast gates from `accessibility.md`; a pair that passes in light often fails in dark.
- **Data colours**: author-declared option colours render as fills with a derived foreground; confirm chips stay legible and delimited on the dark surface.
