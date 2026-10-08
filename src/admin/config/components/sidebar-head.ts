/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The sidebar's head: the brand row and the search trigger. They sit ABOVE the
// nav as siblings inside the `aside` (see `sidebar.ts` for why they cannot be
// children of the `sidebar` node).

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The brand row: a link out to the operator's own site, plus the version chip.
 *
 * `$app.origin` rather than `/`, because this link leaves the console. A `/`
 * here would be rewritten to the mount base by the walk described in `sidebar.ts` and the
 * affordance would silently become "go to the console home" — which the row
 * immediately below it already is.
 *
 * The version chip is OUTSIDE the anchor: it is metadata about the running
 * build, not part of the destination's accessible name.
 *
 * It carries `empty:hidden` because `$app.version` is the ONE app var that
 * always resolves — to `''` when the app declares none, deliberately, so a
 * downstream "no version" fallback never mistakes an unsubstituted token for a
 * real version (`app-vars.ts`). This console declares none, so without the
 * variant the row ends in a 16x4 grey pill containing nothing: a chip that
 * says a build is running and does not say which.
 *
 * ─── THE `v` IS A `::before`, AND THAT IS WHY IT IS NOT IN THE CONTENT ─────
 *
 * The founder rule for operator-facing chrome spells a build `v<ver>`, not a
 * bare number: a lone `1.4.2` beside a name is a number, and `v1.4.2` is a
 * version. But `empty:hidden` matches on the element being EMPTY, and `:empty`
 * is decided by child NODES — so moving the `v` into `content` would fill the
 * chip, and an app declaring no version would render a pill saying just `v`.
 * A `::before` is not a child node, so the chip still collapses when there is
 * nothing to qualify and the `v` appears only beside a real build.
 *
 * ─── THE ENGINE HALF, AND THE ONE THING THAT MADE IT SAYABLE ──────────────
 *
 * The rule's full form is `<app> v<ver> (Sovrium v<engine>)` — the app as the
 * subject, the engine as the qualifier, in that order. The app is the row
 * above; the engine is the line below it.
 *
 * It could not be written until `$app.engineVersion` joined the closed app-var
 * set. The three sources that existed before were each measured and each
 * refused: `$app.version` is the SERVING app's version, which under a mount is
 * the OPERATOR's and would print their number inside Sovrium's parentheses;
 * `GET /api/admin/instance` reports that same number; and
 * `GET /api/admin/config/version` is the real engine read that no shell surface
 * can bind, because a page binds ONE system record while this sidebar belongs
 * to all thirty-odd of them — a `kpi` pointed at it would draw a "Loading KPI"
 * skeleton in the sidebar head of every full page load.
 *
 * ─── WHY A SECOND LINE RATHER THAN A SECOND CHIP ──────────────────────────
 *
 * Read as one sentence the rule is inline, and inline is what does not fit: at
 * 256px the head has ~224px of content, and the app name at `text-md`
 * semibold plus a build chip already claims most of it. A third item on that
 * row wins its space by truncating the app's NAME, which is the one word in
 * the head that has to survive.
 *
 * So the sentence wraps rather than shrinking, and the parentheses are what
 * make the second line legible as a continuation of the first rather than as a
 * second fact. Order is preserved, which is the half of the rule that carries
 * meaning: a head naming the engine first tells an operator the wrong thing
 * about whose console they are looking at.
 *
 * It does NOT collapse the way the chip above does, and that asymmetry is
 * correct. `version` answers `''` for an app that legitimately declares none;
 * the engine always has one — `getSovriumVersion()` falls back rather than
 * throwing — so an absent value here can only mean the render was not threaded
 * it, and the surviving `$app.engineVersion` literal is the loud signal that
 * says so. Blanking it would ship `(Sovrium v)` to an operator instead.
 *
 * ─── THE MONOGRAM SQUARE IS GONE, AND IT IS A GENUINE LOSS ─────────────────
 *
 * The island drew a 28px square holding the FIRST LETTER of the app label,
 * upper-cased. No `$app.*` name yields it — the closed set is `name`, `label`,
 * `version`, `origin`, `basePath` (`src/domain/models/app/pages/app-vars.ts`) — and no
 * component can derive one from a bound value: there is no `initials` or
 * `firstLetter` transform anywhere in the config surface, and there cannot be a
 * literal here because the label is the OPERATOR's, unknown when this file is
 * written. Clipping `$app.label` inside a fixed box was tried and rejected: it
 * renders a truncated word, not a monogram.
 *
 * The missing GENERAL feature is a derived form of a bound value — any app
 * drawing an avatar or a compact brand mark from a name needs it, and none can
 * today. Nothing asserts the square, so it is dropped rather than faked.
 */
export const brandHeader: PageComponent = {
  type: 'container',
  element: 'div',
  // ─── THE WHOLE ROW GOES UNDER THE RAIL, AND THAT IS THE DRAWING ──────────
  //
  // The reference board's rail head is a 36px square holding the app's
  // MONOGRAM — a mark, not a link: it drops the name, drops the version chip,
  // and is not an anchor at all. The console cannot draw that mark. No
  // `$app.*` name yields an initial and no component derives one from a bound
  // value ([internal ref]a measured the closed set), and clipping `$app.label` inside
  // a fixed box renders a truncated word rather than a monogram.
  //
  // So the choice under 56px is an EMPTY square or no square, and no square is
  // the one the drawing agrees with. The cost is named rather than hidden: the
  // "open the site" affordance is unreachable between `md` and `xl`, and comes
  // back with the full sidebar. It returns the moment a derived-initial
  // primitive exists — which is the gap already routed, not a new one.
  props: { className: 'flex flex-col gap-0.5 md:max-xl:hidden' },
  children: [
    {
      // The app's own line: its name, and which build of it is running.
      type: 'container',
      element: 'div',
      props: { className: 'flex items-center gap-2' },
      children: [
        {
          type: 'link',
          props: {
            href: '$app.origin',
            target: '_blank',
            rel: 'noopener',
            'aria-label': '$t:admin.shell.openSite',
            className: 'flex min-w-0 flex-1 items-center gap-2',
          },
          children: [
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground truncate text-md font-semibold' },
              content: '$app.label',
            },
          ],
        },
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              "bg-background-subtle text-foreground-subtle shrink-0 rounded-full px-2 py-0.5 font-mono text-xs leading-[1.3] before:content-['v'] empty:hidden!",
            'data-testid': 'sidebar-version',
          },
          content: '$app.version',
        },
      ],
    },
    {
      // The engine's line, under the app's — the qualifier of the sentence
      // above rather than a second heading, so it is quiet, monospaced like
      // every other version in this console, and truncates rather than wraps.
      //
      // NOT inside the version chip: `-020` reads that chip's text as exactly
      // the app's version, and folding two numbers into one pill would say
      // neither. Its own `data-testid` is an address for a later assertion; the
      // criterion itself is read off the head's TEXT, because what it claims is
      // what an operator reads and in what order.
      type: 'text',
      element: 'p',
      props: {
        className: 'text-foreground-subtle truncate font-mono text-xs leading-[1.3]',
        'data-testid': 'sidebar-engine',
      },
      content: '(Sovrium v$app.engineVersion)',
    },
  ],
} as PageComponent

/**
 * The palette trigger.
 *
 * The hook is `data-command-palette-trigger`, never the accessible name:
 * `CommandPaletteCapture` delegates from `document` on
 * `closest('[data-command-palette-trigger]')`, so the control keeps working
 * before the palette island hydrates AND after the label is translated.
 *
 * ─── IT HAS TO NAME A VARIANT, AND THAT IS NOT COSMETIC ────────────────────
 *
 * A `button` with no `variant` gets `default`, which is the PRIMARY tone: a
 * near-black fill. This row spent months rendering as a black slab with
 * subtle-grey placeholder text on it — 1.9:1, effectively unreadable — because
 * the className carried a border and a text tone but no fill, so the recipe's
 * own `bg-primary` came through underneath. `secondary` is the raised, bordered
 * surface the reference draws, and the className then only has to correct the
 * geometry: a search field is 36px and softly bordered where a button is 32px
 * and firmly so.
 */
export const searchTrigger: PageComponent = {
  type: 'button',
  variant: 'secondary',
  props: {
    type: 'button',
    'aria-label': '$t:admin.shell.search',
    'data-command-palette-trigger': 'true',
    className:
      'border-border text-foreground-subtle hover:text-foreground flex h-9 w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-md font-normal md:max-xl:w-9 md:max-xl:justify-center md:max-xl:px-0',
  },
  children: [
    // The magnifier is drawn at EVERY width, which is both what the reference
    // board draws beside the wide placeholder and the only shape available:
    // an `icon` carries an inline `display:inline-block` from the contentless-
    // placeholder rule (`render/props/props-builder.ts`), and an inline style
    // beats every class-based display utility — so `hidden` / `max-xl:block`
    // on an icon, or on a container wrapping one, cannot switch it. `image`
    // has a carve-out from that rule for exactly this reason; `icon` does not.
    // Routed as a platform gap.
    //
    // Under the rail the two captions go and the button becomes a 36px square,
    // so the glyph is what is left to name the control.
    { type: 'icon', props: { name: 'search', size: 16, className: 'shrink-0' } },
    {
      type: 'text',
      element: 'span',
      props: { className: 'flex-1 text-left max-xl:hidden' },
      content: '$t:admin.shell.searchPlaceholder',
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-foreground-subtle text-sm max-xl:hidden' },
      content: '⌘K',
    },
  ],
} as PageComponent
