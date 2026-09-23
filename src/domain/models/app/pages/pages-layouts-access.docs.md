# Layouts, Sidebars & Access

> Wrap a page body in a data-bound sidebar with `layout`, gate who may load the page with `access`, and alternate one component on what the caller may do or what the app declares.

Two page properties sit outside the component tree: `layout` wraps the body in chrome, and `access` decides who is allowed to load the page at all.

## The `layout` block

<!-- sovrium:options PageLayoutSchema depth=3 -->

`layout` currently holds one key, `sidebar` — an **array** of sidebar sections rendered in the page's aside. Each section binds to a table and emits one entry per record, with `dataSource` and `template` both required. `template` is where the per-record expressions live: `label` and `href` both support `$record.<field>`, and `archivedField` names a field whose truthy value hides the entry.

`activeIndicator` accepts exactly one value — `$currentUser.activeAssignment` — which marks the entry matching the tenant switcher's current scope.

```yaml
name: my-app
tables:
  - name: projects
    fields:
      - { name: name, type: single-line-text }
      - { name: slug, type: single-line-text }
pages:
  - name: Workspace
    path: /workspace
    layout:
      sidebar:
        - dataSource:
            table: projects
            sort: [{ field: name, direction: asc }]
          template:
            label: '$record.name'
            href: '/workspace/$record.slug'
            archivedField: archived
          activeIndicator: '$currentUser.activeAssignment'
    components:
      - { type: container, element: main }
```

## Data-bound sidebars

A sidebar filtered on `$currentUser.assignments.<table>` renders only the records the signed-in user is assigned to; an unrestricted administrator sees them all. Unlike a page-level data source, a sidebar section that cannot resolve its `$currentUser` reference is **dropped silently** rather than failing the request — the page still renders, minus that section.

## Access control

<!-- sovrium:options PageAccessExtendedSchema depth=2 -->

`access` gates the page and takes one of four forms: `all` for everyone including anonymous visitors, which is the default; `authenticated` for any signed-in user; an array of role names, with at least one entry; or an object carrying any of those as `require` plus a `redirectTo` target.

A role-array entry may also be a group reference, `group:<name>`, validated against the app's declared groups.

```yaml
name: my-app
auth:
  strategies:
    - type: emailAndPassword
pages:
  - name: Billing
    path: /billing
    access: { require: authenticated, redirectTo: /login }
    components:
      - { type: text, element: h1, content: 'Billing' }
```

## Gating one component on the caller's powers

`access` gates a whole page on a role NAME. A component's `visibility.capability` gates ONE component on what the caller may actually DO:

```yaml
name: my-app
pages:
  - name: Members
    path: /members
    components:
      - type: button
        props: { id: invite }
        content: Invite a member
        visibility: { capability: administer-accounts }
```

Two powers, and only two: `admin-console` lets the caller reach the operator console at all, and `administer-accounts` lets them create, ban and re-role users.

They are genuinely different. A console viewer satisfies the first, reaches the console, and is refused on every account write — so a surface painting a change-role control for them would be advertising something the backend answers with `404`.

**An unmet capability REMOVES the component, together with everything inside it.** It is not hidden with CSS and not rendered disabled: a hidden action column still ships every row action's endpoint to somebody forbidden to call it, which is a disclosure rather than a style, and a greyed-out control advertises a power that will be refused.

Why not a role list? Because a name is not a power. Whether an `operator` may re-role somebody depends on the levels declared in the app's roles, on whether a higher role exists, and on whether the built-in names were reused — a computation over the whole auth config, not a string comparison. An app that declares its own roles can easily share no names at all with the built-ins.

The set is closed, so a typo is refused at startup rather than becoming a component that silently never renders. It composes with the other visibility keys by AND, and an anonymous visitor holds neither power without any `when: authenticated` written beside it.

### Reserving one column of a grid

A grid's ACTION column takes the same two capabilities, on the column itself. A caller without the power receives the grid, the rows and every other column — and no trace of that one. The header is gone with it: a labelled column over empty cells announces a power the caller does not have, which is the greyed-out control in another spelling.

It is deliberately absent from a FIELD column. A field column renders data the grid already fetched over the wire, so hiding it hides nothing; field confidentiality belongs to the table's field permissions, enforced at the API. Writing `capability` on a field column is refused at startup.

## Alternating a body on what the app declares

`access` and `capability` both ask about the CALLER. `declares` and `unlessDeclares` ask about the app the page is served for:

```yaml
name: my-app
pages:
  - name: Automations
    path: /automations
    components:
      - type: text
        content: Run history for every declared automation
        visibility: { declares: automations }
      - type: text
        content: This app declares no automations yet
        visibility: { unlessDeclares: automations }
```

One authored page, two bodies. An automations directory on an app that declares none is not a `404` — it is a page with an honest empty state, which is exactly the case `access` and `requires` cannot express: both answer an unmet condition by making the page unreachable.

The vocabulary is the same closed set `requires` uses, so the two levels cannot drift into disagreeing about what "declares automations" means. A typo is refused at startup.

The two keys compose by AND, so declaring one capability and excluding another means "for apps that do the first and not the second". Naming the SAME capability in both is refused: it could never render on any instance.

**The unmet half is EXCLUDED from the HTML, not hidden.** A body that alternates is not a style — shipping both and hiding one with CSS tells anyone reading the page source that the instance has a capability it does not have.

## Alternating a body on what the app can actually run

`declares` asks what the app declares. It is not the same question as whether that declaration can run here. An app that declares three agents on a host where `AI_PROVIDER` is unset has declared AI and cannot reach a model, so `declares: agents` renders an assistant whose only possible outcome is a panel saying it is unavailable.

`runtime` and `unlessRuntime` ask the second question:

```yaml
name: my-app
pages:
  - name: Assist
    path: /assist
    components:
      - type: ai-chat
        props: { agent: assistant }
        visibility: { runtime: ai }
      - type: command-palette
        visibility: { unlessRuntime: ai }
```

The composer where a model is reachable, the search trigger everywhere else. That is something graceful degradation cannot do: the chat component already tells the truth about itself when no provider is configured, but a component can only degrade its own body — it cannot give way to a different control with a different label, a different keyboard affordance and a different endpoint.

The predicate is a conjunction of both halves: the app declares something that needs a model, AND the deployment can serve one. So an app declaring no AI surface at all takes the `unlessRuntime` branch even on a host with a provider configured — there is nothing to run, and an assistant bound to no agent is as useless as one bound to an unreachable provider. It therefore replaces `declares: agents` for this shape rather than composing with it; write one key, not two.

The app half is broader than agents alone: an AI field on a table, an `ai` automation action, or a chat component anywhere on any page all count as "this app needs a model".

The set of runtime capabilities is closed and currently has one member, `ai`. A value outside it is refused at startup rather than becoming a component that silently never appears. Naming the same capability in both halves is refused too: AI either runs on this deployment or it does not.

**This is a component gate, never a page requirement.** A page's `requires` is decided once at startup and an unmet page is not registered at all — it returns `404` and leaves every sitemap. Deciding that on an environment variable would make a page appear and disappear with an operator's environment file, so `runtime` alternates a page's body and never its existence.

## What a denial returns

An `access` block carrying `redirectTo` answers an anonymous or unauthorized visitor with a `302` to that path, with the original path appended as a `redirect` query parameter. Without `redirectTo` the answer is `404`, so the page's existence is not disclosed.

**`access` never answers `401`.** It redirects or hides. The only source of a `401` on a page is an unresolvable `$currentUser` reference in a data source — two different mechanisms with two different answers.

## Related reading

- **Pages Overview** — the full page property table.
- **Data Binding** — `$currentUser` scoping and its `401`.
- **Auth, Roles & RBAC** — the role names `access` accepts.
- **Groups** — the `group:` references `access` accepts.
- **Layout Components** — the sidebar component rendered inside the body.
