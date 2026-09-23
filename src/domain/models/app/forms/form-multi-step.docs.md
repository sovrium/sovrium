# Multi-Step Forms

> Splitting a form across screens — the three layout modes, step definitions, branching, and the display overrides.

`layout` chooses how a form's fields are presented: all at once, split into steps with previous and next navigation, or one field per screen. Steps support conditional skipping and branching, so the path through the form adapts to the answers.

```yaml
forms:
  - id: 1
    name: onboarding
    title: Set up your workspace
    layout: multi-step
    submitTo: { table: workspaces }
    fields:
      - { kind: standalone, name: workspace_name, inputType: short-text, required: true }
      - { kind: standalone, name: team_size, inputType: number }
      - { kind: standalone, name: use_case, inputType: long-text }
    steps:
      - { id: basics, title: The basics, fields: [workspace_name] }
      - { id: team, title: Your team, fields: [team_size] }
      - { id: goals, title: Your goals, fields: [use_case] }
```

| Mode           | Presents                                                              |
| -------------- | --------------------------------------------------------------------- |
| `single-page`  | Every field on one page — the default; steps are ignored              |
| `multi-step`   | Fields grouped into steps with previous and next navigation           |
| `one-question` | One field per screen, advancing automatically, on the same step model |

## Step definitions

<!-- sovrium:options FormStepSchema -->

Each step's `fields` names entries from the parent `fields` array — a standalone field's `name`, or a table-bound field's `column` — and needs at least one. `id` is unique within the form.

## Navigation and branching

By default a multi-step form advances linearly. Two mechanisms override that.

**Skipping a step** is a step-level `visibleWhen`: when the condition is false the step leaves the sequence entirely.

**Branching** is `goToWhen`. The first matching rule wins and jumps to its target; if none match, the linear next step is taken.

<!-- sovrium:options GoToRuleSchema -->

```yaml
steps:
  - id: plan
    title: Choose a plan
    fields: [plan]
    goToWhen:
      - when: { field: plan, operator: eq, value: enterprise }
        goTo: sales
  - id: billing
    title: Payment
    fields: [card_number]
  - id: sales
    title: Talk to sales
    fields: [company, seats]
    visibleWhen: { field: plan, operator: eq, value: enterprise }
```

A `goTo` must name a step that exists in the same form.

Pairing a branch with the target's own `visibleWhen`, as above, is the pattern worth copying: the branch routes the enterprise answer to the sales step, and the visibility rule keeps that step out of everybody else's linear path.

## One question at a time

The `one-question` layout presents a single field per screen for a focused, conversational experience. It reuses the same step model — typically one field per step — and the same skipping and branching apply.

```yaml
forms:
  - id: 2
    name: survey
    title: Quick survey
    layout: one-question
    submitTo: { storeSubmission: true }
    fields:
      - {
          kind: standalone,
          name: nps,
          inputType: rating,
          label: How likely are you to recommend us?,
        }
      - { kind: standalone, name: reason, inputType: long-text, label: What is the main reason? }
    steps:
      - { id: q1, fields: [nps] }
      - { id: q2, fields: [reason] }
```

## Display overrides

`display` adjusts how the form looks without touching submission semantics.

<!-- sovrium:options FormDisplaySchema -->

`submitLabel` defaults to "Submit" and accepts a translation key, as every user-facing string here does.

The progress bar is **not** configurable: `multi-step` and `one-question` always render one, and `single-page` has no step boundary to advance through, so it never does. Field layout is likewise fixed at a single column.

```yaml
forms:
  - id: 3
    name: registration
    title: Event registration
    layout: multi-step
    display:
      submitLabel: Complete registration
      theme:
        primaryColor: '#4f46e5'
        borderRadius: 0.5rem
    submitTo: { table: registrations }
    fields:
      - { kind: table-field, column: first_name, required: true }
      - { kind: table-field, column: last_name, required: true }
      - { kind: table-field, column: email, required: true }
      - { kind: table-field, column: dietary_notes }
    steps:
      - { id: name, title: Your name, fields: [first_name, last_name] }
      - { id: contact, title: Contact and preferences, fields: [email, dietary_notes] }
```
