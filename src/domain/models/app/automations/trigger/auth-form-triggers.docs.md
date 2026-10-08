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

| Event           | Fires when                                                                                                             | Does not fire when                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `signUp`        | An account is created, by any enabled strategy                                                                         | —                                                                                              |
| `signIn`        | A sign-in way opens a session: a password, a followed magic link, single sign-on, a passkey, a completed second factor | The sign-up form opens its own session; the sign-in is refused; a magic link is only requested |
| `signOut`       | The person signs out                                                                                                   | A session is revoked, the account is banned, or the session expires                            |
| `passwordReset` | A password reset is completed with a valid link                                                                        | A reset is only requested; the link is invalid or expired                                      |
| `emailVerified` | The address becomes verified                                                                                           | The account is updated later                                                                   |

A first sign-in that also creates the account — a first magic link, a first single sign-on — fires both `signUp` and `signIn`.

Every event hands its actions `{{trigger.data.event}}` and `{{trigger.data.user.*}}` (`id`, `email`, `name`, `role`, …). It never hands them a session, a link token or a password: the run history keeps the trigger data, and reading a run must not let anyone sign in as the person it names.

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
