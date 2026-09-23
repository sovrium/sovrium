# Runtime Data Customization

> What end users can change about a view without a developer changing the config — and the boundary that stops personalisation from widening access.

Developers declare the data model and the pages; users shape how they see the data. Every data-bound view comes with filtering, sorting, grouping, column visibility, saved views and CSV transfer already attached. These are behaviours of the runtime, **not schema properties**: rendering a `table` over one of your tables brings the whole surface with it, and there is nothing to enable beyond the component itself. Toolbar settings decide which of the controls are _surfaced_, never whether the capability exists.

## Two layers of views, and they coexist

Developers define **config views** on a table's `views` array — the curated, named starting points, stored in the config and the same for everyone. Users layer their own **runtime views** on top, saved per user. A user can start from a developer's view and refine it without the config changing, and the developer's view is unaffected by anything the user does to their copy.

| Capability        | What a user can do                                                                |
| ----------------- | --------------------------------------------------------------------------------- |
| Filter            | Build conditions in the toolbar; they stack on top of the developer's base filter |
| Sort              | Reorder by one or more columns                                                    |
| Group             | Collapse rows into sections by a field's value                                    |
| Column visibility | Show and hide columns, where `toolbar.columnToggle` surfaces the control          |
| Saved views       | Store the current filter, sort and field selection under a name                   |
| Share             | Hand a saved view to another user                                                 |

Runtime filters and sorts go through the same query layer the Records API already exposes — the interface composes the very `filter`, `sort`, `fields` and `groupBy` parameters a script would send. A saved view persists that composition under a stable identifier so it re-applies in one click. Nothing about runtime customization is a second, parallel query path, which is why it cannot behave differently from the API under the same permissions.

## The two `views` are different things

```yaml
components:
  - type: table
    dataSource:
      table: contacts
    views: [grid]
    toolbar:
      columnToggle: true
      views: true
```

Saved views are declared on the **table** as `tables[].views`. The component's own `views` property lists which view _types_ — grid, kanban, calendar — its switcher offers. The two are spelled the same and mean different things, so a `views: [grid]` on a component is not a reference to a saved view and will never resolve to one.

`toolbar.views: true` is what surfaces the saved-views dropdown that reads `tables[].views`.

## Moving data in and out

Users can export the full table or a hand-picked selection to CSV, and import a CSV through a mapping wizard that pairs spreadsheet columns to fields. Both honour field-level permissions: a user exports only fields they may read, and imports only into fields they may write. Data tables also support spreadsheet-style clipboard copy and paste, including from an external spreadsheet, with a preview before anything is committed.

## Personalisation never widens access

Every runtime view, export, import and clipboard paste runs through the same table and field-level permissions as the rest of the Records API. A user tailoring their workspace can filter, read, write and share only the data they were already authorized to reach, and an unauthorized record answers `404` here exactly as it does everywhere else in the records path — with one exception: **CSV export refuses with `403`**, because it is an action the caller explicitly asked for on a table already visible to them rather than a probe for a row's existence. **Records Import and Export** says so beside the endpoint.

This is the property that makes the whole surface safe to hand to end users: personalisation composes _on top of_ the permission layer rather than beside it, so there is no configuration in which a saved view, a shared view or an export can return a row its owner could not have listed.
