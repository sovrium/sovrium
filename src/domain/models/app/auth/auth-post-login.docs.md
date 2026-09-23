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
