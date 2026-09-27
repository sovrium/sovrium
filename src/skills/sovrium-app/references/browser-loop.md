# The bounded browser pass

## Contents

- Why one pass, not a loop
- Recon, then action
- The pass, step by step
- Tool aliases for three browser MCPs
- The viewport matrix
- Filtering the console
- Severities
- When there is no browser MCP
- What to report

## Why one pass, not a loop

An open-ended "look, tweak, look again" loop burns context and converges on whatever the last screenshot happened to show. Run ONE batched inspection, collect every finding, fix them together, then run at most ONE confirmation pass. If the confirmation pass still finds something, report it with evidence instead of starting a third pass.

## Recon, then action

Never click or type on a page you have not read. First take an accessibility snapshot of the rendered page to learn its real roles, names and structure; only then act on elements by what the snapshot showed. Server-rendered Sovrium pages mount their interactive parts (tables, forms, calendars) after the HTML arrives, so wait for the network to settle before reading.

## The pass, step by step

1. **Navigate** to the URL `sovrium start --watch` printed. After a restart-class reload the port may have changed: re-read the printed URL.
2. **Wait** until the network is idle (or until a known element is visible).
3. **Snapshot** the accessibility tree. This is your primary evidence for structure: headings, landmarks, labels, the number of rows in a table, the text of an empty state.
4. **Screenshot** only when the question is how it looks (spacing, colour, dark mode, overflow). Save it to a file and keep the path for the report.
5. **Console**: read the console messages and keep only errors and warnings that match a pattern you care about (see below).
6. **Network**: list failed requests (status ≥ 400, or aborted). A `404` from a record endpoint may be a correct permission denial; check which role you are signed in as before calling it a bug.
7. **Resize** to the three widths below and re-snapshot where layout matters.
8. **Interact once** where the change was interactive: submit the form, open the dialog, sort the table. Then snapshot again.
9. **Keyboard**: tab through the changed area once; focus must be visible and in reading order.

If the app has `auth` and the page is not public, sign in first through the page's sign-in form, as the role the page is for. An admin account can be created with `sovrium admin create <email>`.

## Tool aliases for three browser MCPs

The names below are examples of what each server exposes today; use whatever your client lists. Refer to them as `Server:tool`.

| Step        | Playwright MCP                           | Chrome DevTools MCP                     | Claude in Chrome                                |
| ----------- | ---------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Navigate    | `playwright:browser_navigate`            | `chrome-devtools:navigate_page`         | `claude-in-chrome:navigate`                     |
| Structure   | `playwright:browser_snapshot`            | `chrome-devtools:take_snapshot`         | `claude-in-chrome:read_page`                    |
| Appearance  | `playwright:browser_take_screenshot`     | `chrome-devtools:take_screenshot`       | `claude-in-chrome:computer` (screenshot action) |
| Console     | `playwright:browser_console_messages`    | `chrome-devtools:list_console_messages` | `claude-in-chrome:read_console_messages`        |
| Network     | `playwright:browser_network_requests`    | `chrome-devtools:list_network_requests` | `claude-in-chrome:read_network_requests`        |
| Resize      | `playwright:browser_resize`              | `chrome-devtools:resize_page`           | `claude-in-chrome:resize_window`                |
| Assert text | `playwright:browser_verify_text_visible` | (read the snapshot)                     | (read the page)                                 |
| Audit       | (none)                                   | `chrome-devtools:lighthouse_audit`      | (none)                                          |

## The viewport matrix

| Name    | Width × height | What breaks here                                                                 |
| ------- | -------------- | -------------------------------------------------------------------------------- |
| Desktop | 1280 × 800     | Line length too long, content stranded in a wide column                          |
| Tablet  | 768 × 1024     | Sidebars that neither collapse nor fit, two-column grids squeezed                |
| Mobile  | 375 × 812      | Horizontal scroll, tap targets under 24 px, tables without an overflow container |

Check dark mode once at desktop width when the change touches colour.

## Filtering the console

A running app logs noise. Filter by pattern instead of reading everything:

- keep `error` and `warning` levels only;
- keep messages mentioning `hydrat`, `Uncaught`, `TypeError`, `Failed to fetch`, `404`, `500`, or the table, page or component you changed;
- drop extension and favicon noise.

Report the filtered lines verbatim.

## Severities

Classify each finding once, so the fix batch has an order:

| Severity | Meaning                                                                     |
| -------- | --------------------------------------------------------------------------- |
| Blocker  | The change does not work, data is wrong, or a denied user can see something |
| High     | Works but broken at one width, in dark mode, or by keyboard                 |
| Medium   | Visibly off (spacing, alignment, wording) without blocking use              |
| Nitpick  | Taste; mention, do not block on it                                          |

## When there is no browser MCP

**curl the HTML.** Sovrium renders pages on the server, so the initial HTML already carries the headings, text and head tags:

```bash
curl -s http://localhost:3000/ | grep -E '<title>|<h1|<meta name="description"'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/contacts
```

This proves content and status codes, not layout or interactivity.

**A short Playwright script** proves the rest. Treat the page as a black box: navigate, wait, read, act, read again.

```ts
// check.ts — run with: bunx playwright test check.ts  (or node, with playwright installed)
import { test, expect } from '@playwright/test'

test('contacts page renders its table', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('http://localhost:3000/contacts')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: `contacts-${width}.png`, fullPage: true })
  }
  expect(errors).toEqual([])
})
```

Keep the script out of the project unless the user wants it kept.

## What to report

For each change: the URL checked, the widths checked, the screenshot paths, the filtered console lines (or "none"), failed requests with their status, and what you could not verify and why.
