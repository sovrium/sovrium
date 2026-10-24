# Fetched Sidebar Entries

> How the entries a sidebar group fetches from a `source` say which page you are on, and how each of them can open onto a second fetched list.

A group's `source` turns each row of an endpoint into an entry. Those entries take part in the current-entry mark exactly as authored ones do, and the group's source can fetch a second level under each of them.

## Marking a fetched entry

`activeMatch` on a group's `source` applies to every entry it yields, with the meaning it has on an authored entry: `exact` (the default) marks the entry whose filled `hrefTemplate` equals the address, and `prefix` also marks it while the reader is anywhere below it. A sibling address that merely begins with the same characters is never below it: `/projects/harbour-wall` does not claim `/projects/harbour-wall-archive`.

When several entries match the address, the one with the **longest** `href` is the current one, authored or fetched. A section entry that claims a whole area by prefix therefore gives the mark up to the page below it:

```yaml
groups:
  - label: Engineering
    items:
      - { label: Overview, href: /engineer, activeMatch: prefix }
  - label: Projects
    source:
      endpoint: /api/tables/projects/records
      rowsKey: records
      labelKey: name
      hrefTemplate: /engineer/projects/{slug}
      activeMatch: prefix
```

On `/engineer` the Overview entry is current. On `/engineer/projects/harbour-wall/drawings` the Harbour wall project is, and Overview is not: a navigation answers "where am I" once. Fetched entries arrive after the page loads, so until they do the authored entry holds the mark.

`activeMatch` is accepted on an entry's own `source` too, and applies to each row of its list.

## Entries for the reader

A `query` value may name the reader: `$currentUser.id`, `$currentUser.email`, `$currentUser.role` or `$currentUser.isUnrestricted`, inside a wire filter or in the `field:value` shorthand. The server writes in the reader's own value before the page is sent, so a "My apps" group lists each reader the rows they own and the reference never reaches the browser. It works on a group's `source`, an entry's `source` and a `childrenSource`.

```yaml
groups:
  - label: My apps
    source:
      endpoint: /api/tables/hosted_apps/records
      rowsKey: records
      labelKey: name
      hrefTemplate: /apps/{name}
      query: { filter: 'owner:$currentUser.id' }
```

A visitor who is not signed in has no rows of their own: a source naming the reader is not fetched for them, and the group lists nothing. A page that names the reader is never served from the page cache, so a reader who signs in is drawn their own entries.

## A second fetched level

`childrenSource` on a group's `source` makes each fetched entry a disclosure: the entry stays a link to its own page, with a toggle beside it named `Expand {label}` and `Collapse {label}`, and its list is fetched the first time the reader opens it — never for a list nobody opened. The list opens on arrival when the reader is on the entry's own page.

`childrenSource` takes the fields of an entry's `source`: `endpoint`, `rowsKey`, `query`, `labelKey`, `hrefTemplate`, `itemProps`, `activeMatch`, `loadingLabel`, `errorLabel`, `emptyLabel` and `loading`. Its `query` values speak the `{field}` grammar `hrefTemplate` does, filled from the **parent** row, so each entry lists its own children; every other placeholder reads the child row.

```yaml
groups:
  - label: Clients
    source:
      endpoint: /api/tables/companies/records
      rowsKey: records
      labelKey: name
      hrefTemplate: /clients/{name}
      childrenSource:
        endpoint: /api/tables/projects/records
        rowsKey: records
        query: { filter: 'company:{name}' }
        labelKey: name
        hrefTemplate: /projects/{name}
```

The sidebar stops at two fetched levels under a group: `childrenSource` is not accepted on an entry's own `source`, nor inside itself. A fetched tree deeper than that is the `tree` component's job. A `childrenSource` whose `itemProps` names an attribute the renderer owns (`href`, `aria-current`, `class` and the like) is refused at startup, as a group's `itemProps` is.

## An icon and a badge per row

A fetched entry can draw its own icon and its own count, filled from its row with the `{field}` grammar `hrefTemplate` speaks. `icon` is a Lucide name or one emoji; `badge` is any field of the row, or `{unreadCount}`, the reader's own count of unread children a `readState` relationship gives each row of its parent table.

```yaml
groups:
  - label: Spaces
    source:
      endpoint: /api/tables/spaces/records
      rowsKey: records
      labelKey: name
      hrefTemplate: /spaces/{id}
      icon: '{emoji}'
      badge: '{unreadCount}'
```

A row whose icon value is neither a Lucide name nor one emoji draws no icon; an icon written out as anything else is refused at startup. A badge that resolves to empty or `0` draws nothing, and an unread count drops for the reader who read the space and for no one else.
