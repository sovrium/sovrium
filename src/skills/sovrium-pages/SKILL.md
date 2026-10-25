---
name: sovrium-pages
description: Use when creating, redesigning or polishing the pages of a Sovrium app — routes, layouts and page access, choosing and composing components, binding pages to table data or collections, forms, dark mode and responsive behaviour on the page, empty, error and loading states, and the words on the page. Triggers include "add a page", "make this page look better", "landing page", "dashboard", "list of records", "record detail page", "form", "dark mode", "mobile layout", "the design looks generic", "rewrite the copy", and "design first", "mock it up" or "prototype it before building" on a Claude Design canvas. Not this skill for the app-wide visual system — tokens, the brand, component-wide styles — which is `sovrium-design`; nor for discoverability, which is `sovrium-seo-geo`.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium pages

A bare agent builds a Sovrium page the way it would build a React page: it invents a `hero` component that does not exist, writes colours inline, uses the removed `theme` block, binds nothing to data and hard-codes sample rows, leaves every list without an empty state, and ships the same centred-gradient landing page every model produces. In Sovrium a page is configuration: components come from a fixed catalogue, data comes from tables through bindings, and the look comes from the app's `design` block.

Run the core loop from `sovrium-app` underneath this skill: edit → `sovrium validate` → `sovrium dev` → browser → API.

**Asked to design first?** ("design first", "mock it up", "prototype it before building", "show me before you build it".) Then the page is designed on a Claude Design canvas before any edit under `pages`: follow [Design first: the canvas loop](#design-first-the-canvas-loop) from its first step. Do not plan the page in chat and do not edit `pages`: once the config holds what the design needs, the first command is the canvas export, `sovrium design-system <config> --format bundle --pages --prototype=app --output <dir>`, its guide `project/SOVRIUM.md` is read before any board is touched, the plan is drawn on its boards, and nothing is written to `pages` until the person approves them.

## Routes and layouts

- Each entry in `pages` has a `name`, a `path` and `components`. Paths with a `:param` render one record. Manual: `sovrium docs pages/pages-routing`.
- Shared chrome (a sidebar, a header) belongs in a page `layout`, not copied into every page. Manual: `sovrium docs pages/pages-layouts-access`.
- `access` decides who may open a page: `all`, `authenticated`, a role list, or `{ require, redirectTo }`. A visitor who may not see a page gets 404.
- In a multilingual app, every page exists under each language prefix; see `sovrium docs app-schema/languages`.

## Picking components

- The catalogue is fixed and grouped by category; list it with `sovrium docs components` and read the category article, `sovrium docs components/<category>-components` (for example `layout-components`, `content-components`, `navigation-components`, `overlay-components`). Data components have their own section: `sovrium docs data-components`; form controls theirs: `sovrium docs form-controls`.
- There is **no `hero` type**, no `section` type, no `navbar` type. Compose them from `container`, `flex`, `grid`, `text`, `image`, `button` and `card`. An unknown type fails `sovrium validate` with the accepted list.
- Reusable pieces are declared once and referenced; see `sovrium docs components/reusable-components`.
- Every component type and option, generated from the binary: `references/component-catalogue.generated.md`.
- The catalogue follows shadcn/ui's names and anatomy, so reach for the shadcn part by its name before composing one by hand: `aspect-ratio` holds an image, video or map at a fixed shape; `label` names a control; `collapsible` shows or hides one region behind its trigger; `calendar` picks a date, a range or several dates inline; `drawer` slides up from the bottom of the screen while `sheet` slides in from a side; `marker`, `attachment`, `message` and `message-scroller` build a conversation; `questionnaire` asks one question per screen.
- Prefer a component's own slots and options to wrapping it in containers: a `card` has `title`, `description`, an `action` on the title row, a `footer` and a small `size`; an `item` has `media`, `title`, `description`, `actions`, `header` and `footer`; a `field` takes an `orientation`, a `legend` and a list of `errors`; a `combobox` takes `multiple` and draws the choices as `chips`; a `select` groups its options and can be `clearable`; a `sidebar` folds (`collapsible`), takes a `header`, a `footer` and a loading skeleton; `dialog` and `sheet` take a `footer`; `breadcrumb` collapses a long trail; a `chart` also draws `radar` and `radial`. Each option is described in the category article, `sovrium docs components/<category>-components`, and `sovrium validate` names the accepted values.

## Binding data

- Lists, tables, cards, boards, calendars and charts read records through a data binding; never paste sample rows into a page. Manual: `sovrium docs pages/pages-data-binding`.
- A record page (`:param` path) binds one record; a collection generates one route per record or per markdown file. Manual: `sovrium docs pages/pages-collections`.
- Operational data that is not a table (the current user, runs, system lists) comes from system sources. Manual: `sovrium docs pages/system-sources`.
- A binding respects the table's permissions: what a visitor sees is what the API would give them. Test each page as the role it is for.

## Forms

- Forms are declared under the top-level `forms` list and placed on pages by name. Manual: `sovrium docs forms/forms-overview`.
- Who may submit is set on the form: `sovrium docs form-delivery/form-access`. Anti-spam, availability windows and file uploads are in the same section.
- Every field has a visible label, a helpful error message, and a success state that says what happens next.

## Design tokens

- Read the app's brief before touching anything (`sovrium design-system <config>`) and use its tokens, voice and principles as they are; never a colour, size or font written inline on one component.
- Adding or changing a token, the palette, dark colours, fonts, the voice, or the style of every instance of a type is the `sovrium-design` skill.

## Plan before you build

Write a short design plan before adding or changing a component: which mode this is (a new page, a refinement, or a redesign), what the app's `design` block already decides, the structure in greyscale, then type, spacing and layout, and colour last. A plan is cheap to change; a built page is not, and a page built without one drifts toward the generic defaults. The steps and the plan template: `references/design-plan.md`. In design-first mode the same plan is drawn on the canvas boards instead.

## States and forms

A page is not finished when its happy path renders. Every data component needs a first-use empty state, a no-results state, a loading state sized to the wait and an error that says what to do next; every form needs visible labels, errors beside the field that keep the visitor's input, and a success state. Dark mode fails in its own ways and has its own checks. The full checklist: `references/states-and-forms.md`.

## Copy

Words are part of the interface, written in the same pass as the layout and in the app's voice (`design.voice`), not yours. No word that is not doing work, but never cut the sentence that tells the visitor what happens next. One term per concept across the app. Voice, calls to action, labels, messages and the review checklist: `references/copy.md`.

## Critique: one bounded browser pass

The agent judges a page by using it in a browser, not by reading the config or a single
screenshot. It runs **one** batched inspection, fixes what it found in **one** batch, runs
**one** confirmation pass, and stops. It does not loop on taste.

### Before the pass

- Read the design brief (`sovrium design-system <config>`) again. A finding that contradicts the app's own principles, tokens or voice is not a finding; the author's system wins.
- Boot the app (`sovrium dev`) and validate the config (`sovrium validate`) so the pass runs against what will ship.

### The inspection (one pass, all of it)

Run every item on every changed page, collecting findings without fixing yet:

1. **Three widths**: 375 px, 768 px, 1280 px. Look for overflow, horizontal scroll, cramped or orphaned elements, and whether the hierarchy survives.
2. **Dark scheme**: switch scheme and repeat the dark-mode QA list (`references/states-and-forms.md`).
3. **Keyboard**: Tab through the page from the top; open and close every overlay; confirm visible focus and the APG keys (`references/accessibility.md`).
4. **States**: force each data component empty, no-results and error; submit each form empty and with bad input.
5. **Accessibility tree**: take a snapshot of the tree, not only pixels; check names, roles, heading order.
6. **Copy**: read every string against the review checklist in `references/copy.md`.
7. **Console**: note any errors or warnings the page logs.

### The record, one entry per issue

| Field        | Content                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| Heuristic    | Which of the ten heuristics below it breaks (or the WCAG criterion number) |
| Location     | Page route, component, and width or scheme where it shows                  |
| Impact       | What the visitor experiences, in one sentence                              |
| Severity     | Blocker, High, Medium or Nitpick (definitions below)                       |
| Smallest fix | The least change that resolves it, stated as a config edit                 |

Severity:

- **Blocker**: a visitor cannot complete the page's job, or an accessibility gate fails. Fix before anything else.
- **High**: the job completes but with confusion, error risk or clear inconsistency. Fix in this batch.
- **Medium**: friction a regular visitor notices. Fix in this batch if the fix is small; otherwise report it.
- **Nitpick**: polish. Report it; fix only if it is free.

### Fix, confirm, stop

- Apply all Blocker and High fixes, and the cheap Medium ones, in **one** batch of config edits; validate after the batch.
- Run **one** confirmation pass over only the recorded issues and the widths and schemes where they appeared.
- Stop. Report what was fixed, what remains (with severity), and any finding that needs a decision from the author or a capability the config cannot express.
- End the report with one `Decisions to record: <title — touches>` line per nominated decision, or `Decisions to record: none`. Nominate only a data-model shape, the permissions or auth model, SQLite versus PostgreSQL, a design character choice, a disabled or deferred automation, or a security trade-off left in place — never labels, copy or colours. Nominate here; the `sovrium-config-editor` agent writes the `decisions:` record, never this skill.
- A fix that would contradict the app's `design` block is not applied; it is reported as a question to the author.

### The rubric: ten heuristics, as checks

| #   | Heuristic                                              | What the agent checks on a Sovrium page                                                                                                                                      |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visibility of system status                            | Every data component has a loading indicator sized to the wait; saves, imports and long tasks report progress and completion                                                 |
| 2   | Match between the system and the real world            | Labels use the visitor's words from the app's vocabulary table, not field names or internal ids; dates, numbers and currency in the locale's format                          |
| 3   | User control and freedom                               | Dialogs close with Escape and a visible control; destructive actions confirm or offer undo; filters have "Clear all"                                                         |
| 4   | Consistency and standards                              | One term per concept; the same action looks and reads the same on every page; components follow platform conventions                                                         |
| 5   | Error prevention                                       | Right control for the input (radio for five options or fewer, pickers for dates and records); constraints stated before submit; destructive actions separated from safe ones |
| 6   | Recognition rather than recall                         | Options visible instead of remembered; active filters shown; the current page marked in navigation                                                                           |
| 7   | Flexibility and efficiency of use                      | Keyboard paths for frequent actions; bulk actions on lists; density suited to repeated use                                                                                   |
| 8   | Aesthetic and minimalist design                        | Nothing on the page that is not doing work; no item from the anti-slop list the author did not ask for; one primary action                                                   |
| 9   | Help users recognise, diagnose and recover from errors | Every error says what, why and what next, beside its source, without colour alone, keeping the visitor's input                                                               |
| 10  | Help and documentation                                 | Hints beside complex fields; empty states that teach the one thing a first-time visitor needs; links to help where the task is genuinely complex                             |

## Design first: the canvas loop

When the person asks to see a page before it is built ("design first", "mock it up", "prototype it before building"), every change under `pages` is drawn on a Claude Design canvas, approved, then read back into the config. Without that request, edit the config directly. The canvas is a folder of files: `sovrium design-system` writes it, `sovrium design-system import` reads it back, and only the nodes it stamped come back. Manual: `sovrium docs theming/design-pages-import`.

1. **Before.** Declare in the config any table, field, form or page the design needs, then validate. A node naming one the config lacks is left out by name.
2. **Export.** `sovrium design-system <config> --format bundle --pages --prototype=app --seed <dir> --output <dir>` draws every page as a clickable board, adds one stateful Prototype board, and, with `--seed`, takes the boards' rows from the app's seed folder (leave it out when the app has none). `--state <page>:<key>=<value>` adds a board for each state to review (an empty list, an error).
3. **Draft.** Read the canvas's own guide, `project/SOVRIUM.md` (beside the canvas, under `adapters/claude-design/` in a bundle), before editing a board: it says what the import carries, keeps and refuses. Rework a board by editing its `.dc.html` within that guide. A new page starts as a copy of the closest stamped board, with `data-sovrium-page`, `data-sovrium-path` and `data-sovrium-like` on its root (the page it takes its access from), and kit components only. Never add a stub entry to `pages` first: `--new-pages` creates the page from its board.
4. **Review.** The person opens the canvas folder in Claude Design, or reviews the board files, and the edited files come back into the same folder. The Prototype board is for clicking through and is never imported.
5. **Approval.** Write nothing until the person approves the boards, by name.
6. **Dry run.** `sovrium design-system import <dir> --pages --config <config> --dry-run --json` (add `--from claude-design` when the folder is a whole bundle) gives each board's verdict: carried, kept or refused, with node ids. Fix every refusal on the board or in the config, then run it again.
7. **Write.** Run the same command with `--write`: `--new-pages` for a board of a page the config does not have, `--page <name>` for one page, `--sidecar` when a TypeScript config computes `pages`. In a config split with `$ref`, each value is written into the partial that holds it, and the report's `file` and `pathInFile` name where; a fragment several pages include is written only when every board draws it the same, and a file outside the config's folder is refused, so change that one by hand. Edited copy behind a `$t:` key is written in the default language, and the report names the languages left to translate. Review the diff. Writing the same canvas back again changes nothing, so the loop can repeat.
8. **Verify.** The Verify pass below, as for any page change.

What belongs where:

- **Edit the canvas** for the page itself: layout on the spacing scale, copy, variants and sizes, order, adding or removing kit components, colours and type that match a token, and the rules a component carries in its `data-sovrium-*` attributes (a binding, a visibility rule, a data source, a form).
- **Edit the config** for anything new in kind: a table, a field, a form, an automation, an action, a component outside the kit, a value off the scale. The import refuses those, by name, rather than guessing. A TypeScript config is edited literal by literal; an edit to a computed value is refused with the file and line to change by hand.
- **Never** invent a `data-sovrium-*` stamp, write config from a screenshot or a picture, or draw a component outside the kit: the import refuses each, or silently leaves it out.

Colours, type and radii changed in the canvas's Theme menu come back through the token import, which is the `sovrium-design` skill. A client with no shell (the config MCP alone) cannot run the export or the import: say so and build config-first, or give the person the two commands.

## Verify

One bounded browser pass (see `sovrium-app`, `references/browser-loop.md`), then at most one confirmation pass:

```
- [ ] Three widths: 375, 768, 1280 px — no horizontal scroll, hierarchy intact
- [ ] Dark scheme — text and controls readable, no hard-coded light colours
- [ ] Keyboard — every control reachable, focus visible, overlays open and close
- [ ] Empty state — the page with no records says what to do next
- [ ] Error state — a failing binding or a rejected form shows a useful message
- [ ] As the intended role, and as one that should not see the page (expect 404)
- [ ] Console filtered for errors; failed requests listed
```

## Anti-patterns

- A `hero`, `section` or `navbar` component type (they do not exist; compose).
- Colours, sizes or fonts written on components instead of in `design`.
- A `theme` block.
- Sample rows typed into a page instead of a data binding.
- A list, table or board with no empty state.
- A page gated by hiding a link instead of by `access`.
- The same shared chrome copied into every page instead of a `layout`.
- Judging a page from the config or from one desktop screenshot.

## References

- [references/design-plan.md](references/design-plan.md) — read before building or redesigning a page: the mode question, type, spacing, layout, colour last.
- [references/states-and-forms.md](references/states-and-forms.md) — read when a page shows data or takes input: empty, error, loading and success states, form rules, dark-mode checks.
- [references/copy.md](references/copy.md) — read when writing any words on a page: voice, CTAs, labels, messages.
- [references/anti-slop.md](references/anti-slop.md) — read before calling a design finished: the generic patterns to remove.
- [references/accessibility.md](references/accessibility.md) — read for contrast, targets, focus and keyboard rules.
- [references/data-dense.md](references/data-dense.md) — read for tables, dashboards and admin-style pages.
- [references/component-catalogue.generated.md](references/component-catalogue.generated.md) — read when choosing or configuring a component; generated from the binary.
- [references/sources.md](references/sources.md) — where the practices in this skill come from.
