# Form Field Groups

> Breaking a long single-page form into labelled sections, and hiding a whole section behind a condition.

A twenty-field form rendered as one flat column asks the submitter to read every input before understanding any of them. The same fields under three headings become something a person can scan and answer a section at a time.

`fieldGroups` declares those headings. Each entry is a label plus the field names that belong under it.

```yaml
forms:
  - id: 1
    name: apply
    title: Apply for Senior Engineer
    submitTo: { table: candidates }
    fieldGroups:
      - label: About you
        fields: [first_name, last_name, email]
      - label: Your experience
        fields: [years_of_experience, github_url]
    fields:
      - { kind: table-field, column: first_name, required: true }
      - { kind: table-field, column: last_name, required: true }
      - { kind: table-field, column: email, required: true }
      - { kind: standalone, name: years_of_experience, inputType: number }
      - { kind: standalone, name: github_url, inputType: url }
```

## Group properties

<!-- sovrium:options FormFieldGroupSchema -->

`label` and `fields` are both required, and `fields` needs at least one entry. `visibleWhen` gates the whole section and takes the same shape and operators as a field's own rule.

`fieldGroups` is itself optional. Omit it and the form renders its fields top to bottom with no headings, which is right for a form short enough not to need signposting. Declared, the array must hold at least one group.

## Order comes from the groups

Once `fieldGroups` exists it drives the layout: sections render in array order, and each field renders in the position its group gives it. Grouping can therefore reorder a form without touching the `fields` array — that array keeps defining _what_ the fields are, and the groups define _where_ they appear.

A field you never list still renders. It falls through to the bottom, after every section, in source order. Grouping half a form is valid: the named fields get headings, and the rest trail behind as an unlabelled block.

## Conditional sections

```yaml
fieldGroups:
  - label: Preferences
    fields: [wants_relocation]
  - label: Relocation
    fields: [relocation_country, relocation_date]
    visibleWhen: { field: wants_relocation, operator: eq, value: true }
```

The rule is evaluated server-side. On first render there are no answers yet, so a conditional section starts hidden and appears once its trigger is answered. On submit the rule is evaluated again, this time against the submitted values, and a section whose rule is false is treated as though it had never been part of the form: its required fields do not block the submission.

### A hidden section drops its values

When a group's condition is false at submit time, every field under it is **stripped from the payload** before the table write and the ledger write. A value the submitter typed while the section was open — and then hid again by changing the trigger — is not persisted.

Never put a field you always need inside a conditional group. The rule is not "skip validation"; it is "this section was not part of the form".

## Groups or steps

Both carve a form into parts and both take a visibility rule. The difference is what the submitter sees at once.

| Reach for     | When                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `fieldGroups` | Every field stays on one page and one scroll, and headings give it structure |
| `steps`       | Fields are split across screens with navigation and per-step validation      |

Groups require the single-page layout, which is the default; steps require the multi-step or one-question layout.
