# Questionnaire

> The `questionnaire` component — a questionnaire: one question per screen, answered by choosing, with a count of how many remain.

An onboarding quiz, an intake survey, a "which plan fits you" flow: one question at a time, answered by choosing, with "Question 2 of 5" above it. A `questionnaire` holds the answers in the page and sends them **once**, at the end, through one of the app's own forms — the form keeps its validation, its storage and its permissions, and nothing is written until the last screen. Reference: shadcn/ui Questionnaire.

```yaml
forms:
  - id: 1
    name: onboarding-quiz
    title: Onboarding quiz
    submitTo:
      table: onboarding_answers
    fields:
      - kind: table-field
        column: team_size
      - kind: table-field
        column: budget_note
pages:
  - name: Onboarding
    path: /onboarding
    components:
      - type: questionnaire
        formRef: onboarding-quiz
        submitLabel: Finish
        items:
          - name: team_size
            prompt: How many people will use the workspace?
            choices:
              - value: 1-5
                label: 1 to 5
              - value: 6-20
                label: 6 to 20
          - name: budget_note
            prompt: Anything we should know about your budget?
            required: false
            input:
              label: Budget note
```

<!-- sovrium:options type:questionnaire -->

`formRef` and `items` are required. Each item is one screen: its `name` is the field of the form the answer is stored in, `prompt` is the question, and `choices` are the answers offered — or `input` asks for a typed answer instead. A single-choice item moves on as soon as a choice is picked; `multiple: true` keeps several choices and waits for Next. `required: false` offers Skip, and a skipped answer is stored empty. Previous returns to an earlier question with its answer still chosen. `shortcuts: true` lets the number keys pick the choices. A `formRef` naming no form, an item naming no field of it, and an item with neither choices nor an input are refused when the config is validated.

Because it renders a live submit control, a questionnaire is reported, not drawn, in the operator console's component catalogue.
