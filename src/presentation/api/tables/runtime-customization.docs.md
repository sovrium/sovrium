# Runtime Data Customization

> What a reader can change about what she sees without a developer changing the config — for the length of a visit — and the boundary that stops it from widening access.

Developers declare the data model, the views and the pages; readers narrow what they are shown. A grid's toolbar can offer a search box, a filter builder and a sort builder, and every column header sorts on a click. These are behaviours of the runtime rather than stored settings: `toolbar` decides which controls are _surfaced_, and what a reader does with them lasts for her visit only. It is stored nowhere — neither on the server nor in the browser — and a reload shows the component as configured.

## A way of looking at a table is configuration

A lasting way of looking at a table — a filter, a sort, a grouping, a set of visible fields — is one of the table's `views`, declared in the config and the same for everyone its permissions admit. Readers do not save views, share them, or keep table preferences such as column widths or row density. Every data component binds either to one of the table's views or directly to the table, and a board, a calendar and a grid of the same records are three components, each with its own binding — see Views and Data Binding.

| What a reader can do | How long it lasts                                                                |
| -------------------- | -------------------------------------------------------------------------------- |
| Search               | The visit; it narrows what the binding — the view or the table — already returns |
| Filter               | The visit; conditions stack on top of the view's filters or the binding's own    |
| Sort                 | The visit; a header click or the sort builder reorders the rows                  |

Runtime filters and sorts go through the same query layer the Records API already exposes — the interface composes the very `filter` and `sort` parameters a script would send. Nothing about runtime narrowing is a second, parallel query path, which is why it cannot behave differently from the API under the same permissions.

## Moving data in and out

Users can export the full table or a hand-picked selection to CSV, and import a CSV through a mapping wizard that pairs spreadsheet columns to fields. Both honour field-level permissions: a user exports only fields they may read, and imports only into fields they may write. Data tables also support spreadsheet-style clipboard copy and paste, including from an external spreadsheet, with a preview before anything is committed.

## Narrowing never widens access

Every runtime filter, export, import and clipboard paste runs through the same table and field-level permissions as the rest of the Records API. A reader narrowing what she sees can filter, read and write only the data she was already authorized to reach, and an unauthorized record answers `404` here exactly as it does everywhere else in the records path, CSV export included. On a table the caller may not read, any request on the table answers the `404` of a table that does not exist, whatever its shape — a malformed query or body never answers a validation error first.

This is the property that makes the surface safe to hand to readers: narrowing composes _on top of_ the permission layer rather than beside it, so there is no configuration in which a filter or an export returns a row its reader could not have listed.
