# Assignments & Landing Guards

> The token that resolves which records a user may reach, and the page that stops an anonymous visitor before the landing resolver ever runs.

Post-login landing routes a session to the right page. Two mechanisms make that routing _correct_.

## The assignment token

`$currentUser.assignments.<table>` resolves to the set of record ids from the user's access rows for a table declared in `scopeTables`. It appears in two forms, and they behave differently.

### Indexed, in a landing URL

The single-record form substitutes the **first** assignment id, producing a deep link straight to that record.

```yaml
roles:
  - name: customer-admin
    defaultLanding: /portal/clients/$currentUser.assignments.clients[0]
    pickerLanding: /portal/select/clients
```

A role may carry **at most one** such token: with two, the resolver cannot infer which scope to count against. A picker landing must carry **none**, since by definition the multi-record case has no single id to substitute. Both rules are enforced when the configuration is decoded.

### Un-indexed, in a data-source filter

The bare form resolves to the full id list, so a picker page lists exactly the records the user can reach and no others.

```yaml
pages:
  - name: client-picker
    path: /portal/select/clients
    access: authenticated
    components:
      - type: list
        props: { id: clients }
        dataSource:
          table: clients
          filter:
            - field: id
              operator: in
              value: $currentUser.assignments.clients
        children:
          - type: text
            content: $record.name
```

This is what makes the picker safe to expose: the filter is resolved **server-side** from the session, so a user cannot widen it by editing a request.

## The mount path's page is the access guard

`landingPath` must be backed by a page declared at the same path. That page is the unauthenticated-access guard: its access block bounces an anonymous visitor to the sign-in page before the landing resolver runs. For an authenticated visitor the resolver redirects away first, so the page itself is typically empty and never renders.

```yaml
auth:
  landingPath: /portal

pages:
  - name: portal-landing
    path: /portal
    access:
      require: authenticated
      redirectTo: /login
    components: []
```

**Forgetting that page is the most common mistake here.** A mount path with no page behind it leaves an anonymous visitor unguarded at exactly the URL the whole mechanism points at. Always pair the two.

The collision between a page path and the mount path is the **mechanism**, not a conflict to avoid: the colliding page is required.
