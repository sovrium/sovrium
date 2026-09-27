# Form Conditional Logic

> Showing or requiring a field based on what the submitter has entered — one condition shape shared by three rules.

`visibleWhen`, `requiredWhen` and `disabledWhen` all share the same condition shape, so learning one teaches all three.

```yaml
fields:
  - kind: standalone
    name: has_company
    inputType: checkbox
    label: I am signing up on behalf of a company
  - kind: standalone
    name: company_name
    inputType: short-text
    label: Company name
    visibleWhen: { field: has_company, operator: eq, value: 'on' }
    requiredWhen: { field: has_company, operator: eq, value: 'on' }
```

A checkbox on a single-page form is sent as `on` when ticked and not at all when left clear.

| Rule           | Effect when the condition is **true**                         |
| -------------- | ------------------------------------------------------------- |
| `visibleWhen`  | The field is shown; when false it is hidden and not submitted |
| `requiredWhen` | The field becomes required; when false it is optional         |
| `disabledWhen` | Accepted and validated, but not yet applied on a hosted form  |

On a hosted form, a page that embeds one with `formRef`, and a dialog that wraps one, `visibleWhen` and `requiredWhen` are applied live as the person answers, and the page is served with them already applied to its prefilled values. A field hidden by `visibleWhen` is taken off screen and its inputs disabled, so it is neither validated nor sent; `requiredWhen` switches the input's required state. The server applies the same rules again on submit, so a rule always decides what is stored. A rule that reads a `hidden: true` field is applied by the server only, because that field's value never reaches the page.

Each rule lives on the common field base, so it applies to any input-bearing kind. A `section` field supports `visibleWhen` to show or hide an entire labelled group.

## The condition

<!-- sovrium:options VisibleWhenConditionSchema -->

A simple condition names a `field`, an `operator` and — for most operators — a `value`. `empty` and `notEmpty` ignore the value; `in` and `notIn` take an array; everything else takes a scalar.

```yaml
fields:
  - kind: standalone
    name: contact_method
    inputType: select
    label: Preferred contact method
    options:
      - { value: email, label: Email }
      - { value: phone, label: Phone }
  - kind: standalone
    name: phone
    inputType: phone
    label: Phone number
    visibleWhen: { field: contact_method, operator: eq, value: phone }
    requiredWhen: { field: contact_method, operator: eq, value: phone }
```

## Compound conditions

Conditions compose with `and` and `or`, and nest. An `and` block holds when **every** child holds; an `or` block when **any** child does.

```yaml
visibleWhen:
  and:
    - { field: priority, operator: in, value: [high, urgent] }
    - or:
        - { field: budget, operator: gte, value: 10000 }
        - { field: vip_customer, operator: eq, value: true }
```

Unlike an automation's condition group, these **do** nest, so a disjunction of conjunctions is expressible here directly.

## `disabledWhen` is not yet applied on a hosted form

A form declared under `forms` accepts `disabledWhen` and validates its condition, but does not act on it yet: the field stays editable in the browser, and the server stores whatever it receives for it. Do not rely on it to lock a value. When a field should drop out under a condition, use `visibleWhen`: a field it hides is neither validated nor sent, and what was typed into it is discarded.

## Step branching

In a multi-step layout, conditions also drive flow. A step's `goToWhen` rules let a true condition jump to a different step instead of the linear next one, and a step-level `visibleWhen` removes a step from the sequence entirely.

```yaml
steps:
  - id: account-type
    title: Account type
    fields: [plan]
    goToWhen:
      - when: { field: plan, operator: eq, value: enterprise }
        goTo: sales-contact
  - id: billing
    title: Billing
    fields: [card_number, billing_email]
  - id: sales-contact
    title: Talk to sales
    fields: [company, seats]
```

## Conditions travel with the form

When a top-level form is embedded in a page, all of its conditional logic comes along: the three rules and step branching behave identically whether the form is rendered at its own route or inline on a host page. Define the conditions once, and every embed inherits them.
