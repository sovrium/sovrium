# Page References

> The reference families a page resolves — `$record`, `$vars`, `$currentUser`, `$t:` and the browser-side `$session` — plus the two page inputs that put a value in the URL, `query` and `window`.

Component `content` and `props` values resolve four reference families at render time:

| Reference             | Resolves to                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| `$record.<field>`     | A field of the current data-source record.                                    |
| `$vars.<key>`         | A page-scoped variable declared in the page's `vars`.                         |
| `$currentUser.<path>` | Session context, per request.                                                 |
| `$t:<key>`            | A translation key, falling back to the key itself when no translation exists. |

A page rendered from `markdown` additionally exposes `$frontmatter.*`. A fifth reference, `$session.<field>`, resolves in the browser rather than at render time.

## Query parameters as page inputs

<!-- sovrium:options PageQueryPropSchema depth=2 -->

A page's `query` block opens URL query parameters as page inputs, referenceable as `$query.<name>` wherever `$vars` substitution runs. Each declares a **closed allow-list** and a default:

```yaml
name: my-app
pages:
  - name: dashboard
    path: /dashboard
    query:
      period:
        default: 7d
        enum: [24h, 7d, 30d]
    components:
      - { type: text, content: 'Showing the last $query.period' }
```

`/dashboard` renders `7d`; `/dashboard?period=30d` renders `30d`.

**An unknown value falls back to the default — the page never answers 400.** A query string is supplied by whoever holds the link, and a stale bookmark is not an error condition, so an unrecognised value renders exactly as though the parameter were absent. Bounding the accepted set also bounds the response space to one rendering per allowed value, which is what keeps the page cacheable per value.

`default` must be one of its own `enum` values, and each property name must be lowercase kebab-case; both are checked at startup.

## Constraining a route segment

<!-- sovrium:options PageParamPropSchema depth=2 -->

A page's `params` block constrains a `:segment` to a closed set supplied by a read endpoint. A segment outside the set answers `404` rather than rendering an empty page — the same distinction the records explorer draws between "does not exist" and "is empty".

## A relative look-back window

<!-- sovrium:options PageWindowSchema depth=2 -->

An analytics reader wants absolute instants, and `$query.period` substitutes the preset id `7d`, which is not a timestamp. A page's `window` block closes that: it declares a closed list of relative spans selected from the URL, and resolves the chosen one into concrete instants at render.

```yaml
name: my-app
pages:
  - name: analytics
    path: /analytics
    window:
      param: period
      default: 7d
      presets:
        - { id: 24h, granularity: hour, label: last 24 hours }
        - { id: 7d }
        - { id: 30d }
    components:
      - type: text
        content: Measured over the $window.label.
```

Five references resolve, once per render:

| Reference             | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| `$window.start`       | ISO instant the window opens at.                             |
| `$window.end`         | ISO instant it closes at — the moment the page was rendered. |
| `$window.granularity` | Bucket width for a time series: hour, day, week or month.    |
| `$window.label`       | The phrase naming the window in visible copy.                |
| `$window.id`          | The active preset id, for marking a selector.                |

A preset id is a span — a positive integer followed by `h`, `d` or `w`, as in `24h`, `7d`, `2w`. Months and years are absent because neither has a fixed length, so "one month back from March 31st" has no single defensible answer. Granularity and label derive from the span and may each be overridden per preset.

They resolve **once** per render, against a single instant. Panels that each read the clock for themselves would drift their windows apart by however long the render took, and a page reporting two periods at once invites you to compare them.

**An unrecognised value falls back to the default and answers 200**, exactly as `query` does. Keeping the list closed is also what keeps the page cacheable: the reachable set is one rendering per preset, and a cached rendering carries both the preset and a minute-coarsened end instant, so a figure is never served under a timestamp it was not measured at.

`default` must name one of the declared presets, ids must be unique, and `param` may not shadow a `query` property name; all three are checked at startup.

## Current-user scoping

`$currentUser` resolves per request during server rendering and is never cached across users.

| Path                               | Value                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- |
| `$currentUser.id`                  | The signed-in user's id.                                              |
| `$currentUser.email`               | Their email address.                                                  |
| `$currentUser.role`                | Their role name.                                                      |
| `$currentUser.isUnrestricted`      | `true` for a global admin, who bypasses assignment scoping.           |
| `$currentUser.assignments.<table>` | The record ids the user is assigned to in that table. Pair with `in`. |
| `$currentUser.activeAssignment`    | The tenant switcher's active scope, or nothing.                       |

```yaml
name: my-app
tables:
  - name: projects
    fields:
      - { name: name, type: single-line-text }
pages:
  - name: Projects
    path: /projects
    components:
      - type: table
        dataSource:
          table: projects
          filter:
            - { field: id, operator: in, value: '$currentUser.assignments.projects' }
```

**A `$currentUser` filter makes the page authenticated.** Resolving one with no session answers `401 Unauthorized` — separate from the page `access` gate, which redirects or answers `404` instead. A sidebar section that hits the same condition is dropped silently rather than failing the page.

## Session-bound text

`$session.<field>` resolves the **signed-in caller's own** session field — `email`, `name`, `role` or `id` — inside a component's `content`. It is the browser-side counterpart to `$currentUser`, and where it resolves is the whole difference: `$currentUser` is substituted server-side per request, `$session` after the page has been served. That is what lets a session-bound greeting sit on a statically cached page without the cache ever carrying one reader's identity to the next.

A token that resolves to nothing — an anonymous caller, or a field the account does not carry — becomes the empty string.

### Optional segments

A bare token cannot carry its own punctuation. A greeting written as `Welcome, $session.name` is well-formed and wrong twice over: the server has no session, so the served bytes read `Welcome,` with a dangling comma for every reader without JavaScript, and a signed-in caller whose account holds no display name reads the same thing. The comma belongs to the name, and the token form has no way to say so.

Wrap the literal and its token in square brackets to make them one grammatical unit:

```yaml
name: my-app
pages:
  - name: Dashboard
    path: /dashboard
    components:
      - type: text
        element: h1
        content: 'Welcome[, $session.name]'
```

A caller signed in with a display name reads `Welcome, Alice Johnson`; an anonymous one, or a signed-in one with no display name, reads `Welcome`.

A segment is all-or-nothing: every token inside it must resolve non-empty, or the whole segment goes — brackets, literals and all. A half-resolved unit is precisely the dangling punctuation the segment exists to prevent. Segments do not nest, and one may not contain a further bracket.

**Brackets are a segment only where a session token lives inside them.** A phrase such as `Status [draft]` holds no session token, so it renders verbatim, brackets included — square brackets are ordinary prose, and copy that never asked for this grammar is untouched by it. A token **outside** any brackets is unchanged too: it resolves, or it becomes the empty string.

The server drops every optional segment and hydration adds it back. That direction is deliberate: a heading that reads `Welcome` and then grows is legible at every instant, where one that arrives empty and fills in is a layout shift on the first thing a reader looks at.

## Related reading

- **Data Binding** — the `dataSource` that produces `$record`.
- **Pages Overview** — `vars` and the rest of the page property table.
- **Languages** — the `$t:` keys and how a page resolves its language.
- **Layouts, Sidebars & Access** — the `access` gate and its different answer.
