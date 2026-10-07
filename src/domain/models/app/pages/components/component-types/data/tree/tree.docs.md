# Trees

> The `tree` component — the records of one table, nested by a relationship that points back at the same table.

A `tree` draws a hierarchy that lives in the records themselves: folders inside folders, accounts under accounts, teams under teams. Each record names its parent through `parentField`, a relationship to the bound table itself, and a record with no parent is a root.

<!-- sovrium:options type:tree -->

`labelField` names each node and `countField` adds a figure after it, in the mono face. Siblings are ordered by `sortBy`. `expanded` sets how many levels are open at first (one by default), and `search` (on by default) draws a filter box that keeps every match's ancestors visible, so a match is never shown out of place.

Selecting a node runs `onSelect` — `navigate` to its page or `openDrawer` to show it on this one — and, with `publishes`, sends the selected id on a shared-filter channel, so a `table` beside the tree narrows to the selected branch.

## A parent can never be its own ancestor

A relationship may point at its own table, and saving a record refuses a parent that would make the record its own ancestor. A batch update is judged as if all its moves had landed, so two moves that close a loop only together are refused, and the whole batch with them. The tree therefore never meets a cycle. A row whose parent a view hides is drawn as a root.

## Keyboard

The tree follows the WAI tree pattern: one node in the tab order, arrow keys to move and to open or close a branch, Home and End for the first and last visible node, Enter or Space to select, and type-ahead to jump to the next node starting with the letter typed.
