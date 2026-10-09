# Post-Login Landing

> Sending each role to its own page after sign-in — expressed as auth configuration rather than as redirect logic scattered across pages.

An admin should land on the admin home, a customer on their own record. Each role declares a landing, the auth block declares the mount point, and a fallback catches whoever matches nothing.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  scopeTables: [clients]
  defaultRole: customer-admin
  landingPath: /portal
  noAccessPath: /403
  roles:
    - name: engineer
      defaultLanding: /admin
    - name: customer-admin
      defaultLanding: /portal/clients/$currentUser.assignments.clients[0]
      pickerLanding: /portal/select/clients
```

## Four fields, two on each side

| Field            | Declared on | Does                                                                           |
| ---------------- | ----------- | ------------------------------------------------------------------------------ |
| `landingPath`    | `auth`      | The mount point; a session navigating here is redirected to its role's landing |
| `noAccessPath`   | `auth`      | Where a session that matches no role goes; defaults to `/403`                  |
| `defaultLanding` | a role      | That role's landing URL; may carry at most one assignment token                |
| `pickerLanding`  | a role      | The multi-record fallback for a **templated** landing; carries no token        |

All four must start with `/`. `landingPath` and `pickerLanding` are entirely yours to name — there is no engine convention behind `/portal` or `/portal/select/clients`.

### Three cross-field rules

Checked when the configuration is decoded, so a half-wired setup fails validation rather than misrouting at runtime:

- `landingPath` **must** be set once any role declares a landing or a picker.
- A role with a picker **must** also declare a landing — the picker is a fallback, not a landing in its own right.
- That landing **must** be templated. A picker beside a bare URL can never fire, so it is refused rather than left as dead configuration.

## How a session is resolved

When an authenticated session navigates to the mount point, the engine walks the roles in **declaration order** and applies the first one the user holds. Order is therefore meaningful: declare the most specific role first.

| The landing is           | Assignments for the templated table | The engine                       |
| ------------------------ | ----------------------------------- | -------------------------------- |
| A bare URL               | not applicable                      | Redirects there unconditionally  |
| Templated                | exactly one                         | Substitutes the id and redirects |
| Templated                | more than one                       | Redirects to the role's picker   |
| No role matched, or none | not applicable                      | Redirects to the no-access path  |

### A landing for a built-in role

An app that needs no role of its own can still send its built-in roles to different pages. List the built-in role under `roles` with nothing but a `defaultLanding` (and, for a templated one, a `pickerLanding`): it lands the accounts that hold that role, and its level, tier and invite right stay the engine's. A built-in role listed with a `level`, a `dashboardTier` or `canInvite` — or without a landing — is refused, since those belong to the engine.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  landingPath: /home
  roles:
    - name: admin
      defaultLanding: /review
    - name: member
      defaultLanding: /my-expenses
```

## A worked example

```yaml
auth:
  strategies:
    - type: emailAndPassword
  scopeTables: [clients]
  defaultRole: customer-admin
  landingPath: /portal
  noAccessPath: /403
  roles:
    - name: engineer
      defaultLanding: /admin
    - name: customer-admin
      defaultLanding: /portal/clients/$currentUser.assignments.clients[0]
      pickerLanding: /portal/select/clients

pages:
  - name: portal-landing
    path: /portal
    access: { require: authenticated, redirectTo: /login }
    components: []
  - name: client-detail
    path: /portal/clients/:id
    access: authenticated
    components: []
  - name: client-picker
    path: /portal/select/clients
    access: authenticated
    components: []
  - name: admin-home
    path: /admin
    access: [engineer]
    components: []
  - name: forbidden
    path: /403
    access: authenticated
    components: []
```

An engineer lands on the admin home; a customer-admin with one client lands on that client's page; with several, on the picker; and anyone the resolver cannot place reaches the no-access page.

## A way back named in the address

A page that sends a signed-out visitor to sign in can name where to come back to, as a `callbackURL` query parameter on the sign-in page's address. The OAuth consent screen does this: it sends the visitor to `/login?callbackURL=<the consent screen's own address>`. A sign-in form (`method: login`, with a password, a mailed link or a social provider) on that page then returns the reader there once they are signed in, ahead of its own `onSuccess` destination.

Only a path on your own origin is followed. A `callbackURL` that names another host, or that is not a path starting with a single `/`, is ignored and the form's own destination applies, so the parameter cannot send a reader away from your app.
