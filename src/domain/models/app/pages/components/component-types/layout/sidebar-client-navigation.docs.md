# Client-side Navigation

> Two sidebar options for apps that move between pages without a full reload — `clientSideNavigation` swaps the content region on a link click, and `trackNavigation` keeps the current-entry mark true after a swap.

By default every link in a Sovrium app is an ordinary page load: the browser fetches a new document, and everything on the page — tables, boards, their loaded rows — starts again from nothing. That is simple and always correct. These two options trade a little of that simplicity for a navigation that feels instant.

## `clientSideNavigation`

`clientSideNavigation: true` on a `sidebar` turns a click on an in-app link into a content swap. Sovrium fetches only the destination's `<main id="main-content">` element and replaces the current one in place; the document itself is never reloaded.

```yaml
pages:
  - name: deals
    path: /deals
    components:
      - type: sidebar
        clientSideNavigation: true
        groups:
          - label: Sales
            items:
              - { label: Deals, href: /deals }
              - { label: Pipeline, href: /pipeline }
```

Declare it on the sidebar of every page that should take part. A page whose sidebar does not set it loads in full when the reader arrives on it, and its own links are ordinary page loads.

**What survives the swap.** The document, the client runtime, and the data it has already loaded. A table or board the reader has seen renders its rows at once on return — no loading skeleton — and refreshes them in the background. The page title follows the destination, and so do browser back and forward: each re-swaps the region the address bar points at.

**The sidebar comes with the content.** It sits inside `<main id="main-content">`, so the server renders it again for the destination with the right entry carrying `aria-current="page"`. You do not need `trackNavigation` alongside it.

**What is never intercepted.** A click with a modifier key, a middle click, a link with `target="_blank"` or `download`, a link to another origin, a link to `/_admin`, `/api/` or `/assets/`, a fragment link within the current page, and any link carrying the `data-no-spa` attribute. Each behaves exactly as it would without the option. Use `data-no-spa` on a link that must always load a fresh document.

**Pages that always load in full.** A destination that declares `scripts`, sets `presence: true`, or uses a record-bound `layout.sidebar` is loaded as a whole document, because each of those lives outside the swapped region. The same happens when the destination answers with an error, redirects (to sign-in, for example), or when the page the reader is leaving has a record-bound `layout.sidebar` or `presence: true` of its own. The reader still arrives; it is simply a page load.

**Listeners keep working.** After every swap, `sovrium:navigated` is dispatched on `document`, the same event described under `trackNavigation` below, so a script listening for it sees client-side navigations as it would any other.

**One known difference.** The sidebar is rendered again with each destination, so its own scroll position returns to the top on every navigation. In a long sidebar the reader keeps their place in the content, not in the list.

## `trackNavigation`

`aria-current="page"` is resolved on the server, which is right and sufficient for an app whose every navigation is a page load. An app that swaps its content region in place leaves the sidebar mounted and the server's mark frozen on the page the reader has already left — so the one element that answers "where am I" becomes the one element that is wrong.

`trackNavigation: true` re-derives the mark on the client after a same-document navigation. It is opt-in because it costs a client island, and an app doing only full page loads gains nothing from it.

The mark moves on two signals. **`popstate`** — browser back and forward — needs nothing from your app. The other is **`sovrium:navigated`**, the event an in-app swapper announces. Update `window.location` first, then dispatch a `CustomEvent` on `document`:

```ts
history.pushState({}, '', '/products/widgets')
document.dispatchEvent(
  new CustomEvent('sovrium:navigated', { detail: { path: '/products/widgets' } })
)
```

That order is the contract, not a convention: the sidebar reads `window.location` itself, so `detail.path` is informational, and dispatching before the location is updated re-derives the mark onto the page the reader is leaving.

`activeMatch` is re-evaluated by the same rule on the client as on the server, so a `prefix` entry keeps its mark across a drill-in. A disclosure whose section becomes current opens with it — but is never re-opened after the reader has deliberately collapsed it.
