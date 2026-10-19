# Build an accessible app

> What Sovrium guarantees for accessibility on every page it renders, what remains yours to get right, and how to check your own app against WCAG 2.1 AA, the level the French RGAA 4.1 standard rests on.

You publish an app that must be accessible: a public body in France has to meet RGAA 4.1, and many organisations hold themselves to WCAG 2.1 level AA. Sovrium renders every page from your config, so most of the markup a screen reader or a keyboard user meets is the engine's job. Your part is the content.

## What the engine guarantees

**Language and structure.** Every page declares its language on `<html>`, carries its own `<title>`, and has exactly one `main` landmark. A skip link is the first thing the keyboard reaches; it is written in the page's language ("Skip to main content", "Aller au contenu principal") and moves focus to the main content. Engine chrome follows the language of the page: buttons, legends, error messages and announcements come in English or French from the engine's own strings, and you rename any of them in `languages.translations` under the `sovrium.` prefix. An empty state's title is text, not a heading, and a board's column titles are headings one level under the page's, so the engine never breaks your page's outline. Rows the engine draws as list items sit in a list.

**Keyboard and focus.** Every control the keyboard can reach shows where focus is, charts included. A modal dialog keeps focus inside it while it is open, hides the page behind it from assistive technology, and returns focus to the control that opened it when it closes on Escape. Nothing traps the keyboard, and pages reflow at 320 px wide without horizontal scrolling.

**Links and buttons that open a new tab.** A link or a button that opens a new tab says so in its accessible name, in the page language ("(opens in a new tab)", "(s’ouvre dans un nouvel onglet)"), without changing its visible text. That holds for a `link` whose target is `_blank`, a button whose click opens an address with `openInNewTab`, the docs contribution links, and the chrome the engine adds itself.

**Forms.** A `field`'s label names the control inside it — an input, a select's trigger, or a searchable combobox — even when the control sits inside a layout wrapper. A required field is exposed as required to assistive technology, and a visible legend in the page language explains the asterisk ("Fields marked * are required"). A form submitted empty marks each empty field in error, links the message to its field, and announces no generic failure over them. A toast is announced once, through a single live region.

**Data components.** A grouped table puts its expanded state on the group's toggle button, a progress cell is named after its column, a search box with suggestions is a combobox, and a markdown article gets a document title from its own heading.

**Contrast.** On the default theme, text reaches 4.5:1 against the surfaces it sits on, and the border of a form field reaches 3:1 against the page, in light and dark mode. The default colours come from the design system the engine ships; where three of its defaults fall short of those thresholds — muted text, field borders and, in light mode, the destructive red — the engine raises them, and that adjustment is the only place its default theme departs from the design system.

## What stays yours

The engine cannot know what your content means. These are your responsibility:

- **Text alternatives.** Give every informative image an `alt` that says what it shows; leave a decorative image's `alt` empty.
- **Link text.** Write links that make sense out of context — "Download the 2026 price list", not "click here".
- **Heading levels in your own pages.** One `h1` per page, then `h2`, `h3` in order. A form embedded with `formRef` titles itself as an `h2`; when that form is the page's main content, give the page its own `h1`, or set `props.headingLevel` so the outline still reads in order.
- **Autofill on personal data.** Set `autocomplete` on fields that collect a person's details — `name`, `email`, `tel`, `organization`, `street-address` — so browsers and assistive tools can fill them.
- **Colours you choose.** A custom `design` replaces the default colours, and with them the engine's contrast guarantee. Check every text and border colour you set against the same thresholds: 4.5:1 for text, 3:1 for large text and for the edges of controls.
- **Media.** Captions for videos with speech, a transcript for audio, and no content that flashes more than three times a second. A scrolling band (`marquee`) needs `pauseControl: true` when it moves for more than five seconds.
- **Language changes inside a page.** Mark a passage written in another language than the page's, so a screen reader switches its pronunciation.
- **Plain language.** Short sentences, familiar words, and instructions that do not rely on colour or position alone.

## Check your app

Scan your own pages with axe through Playwright, restricted to the WCAG 2.1 AA rules:

```bash
bun add -d @playwright/test @axe-core/playwright
```

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const pages = ['/', '/contact', '/sign-in']

for (const path of pages) {
  test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(`http://localhost:3000${path}`)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}
```

Start your app with `sovrium start app.yaml`, then run `bunx playwright test`. Scan the pages a visitor reaches signed in as well as signed out, in each of your languages, and in dark mode if your app follows the system scheme.

An automated scan checks only the criteria a machine can decide: contrast, names, labels, landmarks, ARIA validity. It cannot judge whether an image's text alternative is right, whether a heading describes its section, or whether a page can be used from the keyboard from start to finish. A conformity statement under RGAA 4.1 needs a manual audit, criterion by criterion, by someone who uses the app with a keyboard and a screen reader.

## Next

- **Pages** — page metadata, the `lang` of each page, and the skip link.
- **Forms** — labels, required fields, `autocomplete`, and error messages.
- **Theming** — the default colours and how a custom `design` replaces them.
