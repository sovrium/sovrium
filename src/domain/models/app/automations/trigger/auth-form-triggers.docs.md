# Auth & Form Triggers

> The two triggers a person starts by using your app — authenticating, or submitting a form.

Both are the usual entry point for onboarding, notification and CRM-sync workflows.

## Auth trigger

Fires on an authentication lifecycle event.

```yaml
automations:
  - name: welcome-new-user
    trigger:
      type: auth
      events: [signUp]
    actions:
      - name: welcome
        type: email
        operator: send
        props:
          to: '{{trigger.data.user.email}}'
          subject: Welcome aboard
          body: 'Thanks for joining, {{trigger.data.user.name}}.'
```

<!-- sovrium:options AuthTriggerSchema -->

| Event           | Fires when                                     |
| --------------- | ---------------------------------------------- |
| `signUp`        | An account is created, by any enabled strategy |
| `signIn`        | A session is issued                            |
| `signOut`       | A session is ended by the user                 |
| `passwordReset` | A password reset completes                     |
| `emailVerified` | A verification link is followed                |

`events` is the trigger's **only** narrowing property. There is no way to restrict an auth trigger to a role, a domain or an OAuth provider in the trigger itself — do that in the first action, with a filter gate.

### `signUp` and `emailVerified` are not interchangeable

Under `requireEmailVerification: true`, `signUp` fires for an account that cannot yet sign in. If a welcome message should only reach a real, reachable mailbox, trigger on `emailVerified` instead — otherwise the first thing a mistyped address produces is a bounce.

## Form trigger

Fires when a top-level form is submitted.

```yaml
forms:
  - name: contact-request

automations:
  - name: route-contact-request
    trigger:
      type: form
      form: contact-request
    actions:
      - name: createLead
        type: record
        operator: create
        props:
          table: leads
          data: { email: '{{trigger.data.email}}' }
```

<!-- sovrium:options FormTriggerSchema -->

`form` references a declared form's `name`, and the reference is cross-validated when the configuration is decoded: renaming a form breaks `sovrium validate` rather than leaving an automation that never fires again.

It is a form **name**, not a page path. A form reachable from several pages therefore has one trigger rather than one per route.

Submitted values arrive at `{{trigger.data.<field>}}`, keyed by form field name.

### Which half of the submission to use

A form trigger runs the automation **independently** of the submission's reply. Work that must finish before the submitter sees a response belongs in the form's own success handling instead; work whose latency the submitter should not pay for belongs here.
