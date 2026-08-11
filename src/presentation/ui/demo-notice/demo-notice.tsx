/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getDemoNoticeDisplayConfig, type DemoNoticeDisplayConfig } from './demo-notice-config'
import { getDemoNoticeLabels, type DemoNoticeLabels } from './demo-notice-labels'

/**
 * The ONE deliberate, scoped exception to the notice's zero-JS discipline: a
 * tiny inline SSR script that powers the credential-prefill button. It is not an
 * island and never hydrates React.
 *
 * At parse time (before `DOMContentLoaded`, so before any auth-form island
 * mounts) it looks for a sign-in form — `form[data-action-type="auth"]` carrying
 * both an `email` and a `password` input. When there is none it returns and the
 * button stays `hidden`; when there is one it unhides the button and wires a
 * click to fill both inputs from the button's `data-demo-*` attributes.
 *
 * The form is RE-QUERIED inside the click handler rather than captured once: the
 * auth-form island mounts via `createRoot` and REPLACES the server-rendered form
 * node, so a cached reference would go stale. Credentials are read from the
 * button's dataset — never interpolated into this static script body — so no
 * demo credential is ever baked into the emitted JavaScript. It is FILL-ONLY: it
 * dispatches bubbling `input`+`change` and focuses the submit button, but never
 * submits, so the visitor stays on the page until they choose to sign in.
 */
const DEMO_NOTICE_PREFILL_SCRIPT = `(function () {
  function findAuthForm() {
    var forms = document.querySelectorAll('form[data-action-type="auth"]');
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].querySelector('input[name="email"]') && forms[i].querySelector('input[name="password"]')) {
        return forms[i];
      }
    }
    return null;
  }
  if (!findAuthForm()) return;
  var btn = document.querySelector('[data-testid="demo-notice-prefill"]');
  if (!btn) return;
  btn.hidden = false;
  btn.addEventListener('click', function () {
    var form = findAuthForm();
    if (!form) return;
    var email = form.querySelector('input[name="email"]');
    var password = form.querySelector('input[name="password"]');
    function fill(input, value) {
      if (!input) return;
      input.value = value || '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    fill(email, btn.getAttribute('data-demo-email'));
    fill(password, btn.getAttribute('data-demo-password'));
    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.focus();
    else if (email) email.focus();
  });
})();`

/**
 * The collapsed-state pill (and the disclosure control in BOTH states).
 *
 * Extracted from {@link DemoNotice} purely so each of the two visual states is
 * one readable unit and the parent stays under the 60-line React component cap;
 * it has no independent use and is deliberately module-private.
 */
function DemoNoticeSummary({ label }: { readonly label: string }): Readonly<ReactElement> {
  return (
    /*
      The collapsed state is a badge-shaped pill: same rounded/border/shadow
      language as the bottom-right badge, so a visitor who dismisses the panel
      is left with something that reads as intentional platform chrome rather
      than a stray control. `list-none` drops the default disclosure triangle
      (the chevron below is the affordance); the webkit variant covers Safari,
      which still paints its own marker pseudo-element.
    */
    <summary className="border-border bg-background-raised text-foreground-muted hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors [&::-webkit-details-marker]:hidden">
      {label}
      {/*
        Rotating chevron: without it the pill reads as a static label rather
        than a disclosure control, and nothing signals that a panel is attached.
        `aria-hidden` because `<summary>` already exposes expanded/collapsed
        state to assistive tech — the glyph is redundant there, decorative here.
      */}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="h-3 w-3 transition-transform duration-150 group-open:rotate-180"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Points UP when collapsed, because the panel now grows upward;
            `group-open:rotate-180` flips it to point down (= "collapse"). */}
        <path d="M3 7.5 6 4.5 9 7.5" />
      </svg>
    </summary>
  )
}

/**
 * The expanded panel: what this instance is, the data-reset expectation, the
 * optional display credentials, and the optional product-page link.
 *
 * `hidden group-open:block` rather than relying on the browser's built-in
 * closed-`<details>` behaviour. Chromium hides closed content via
 * `content-visibility` on the `::details-content` pseudo-element, which leaves
 * the panel's own computed `display` untouched — so the copy stays in the
 * accessibility/text tree and assistive tech (and any tooling that reads
 * element text) can still surface a panel the visitor has explicitly dismissed.
 * Toggling real `display: none` off the `[open]` attribute makes "collapsed"
 * mean collapsed everywhere, with no client JavaScript.
 */
/**
 * The credentials block: label, the two monospace chips, and the prefill
 * button on its own row. Rendered only when BOTH display credentials are set
 * (the caller gates on `config.credentials`).
 */
function DemoNoticeCredentials({
  credentials,
  labels,
}: {
  readonly credentials: NonNullable<DemoNoticeDisplayConfig['credentials']>
  readonly labels: DemoNoticeLabels
}): Readonly<ReactElement> {
  return (
    <div
      data-testid="demo-notice-credentials"
      className="mt-2"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span>{labels.credentialsLabel}</span>
        {/*
          Monospace chips: these are values a visitor has to copy by eye into
          a sign-in form, so they get a scannable treatment that makes the
          exact character run unambiguous (l vs 1, O vs 0).
        */}
        <code className="bg-background-subtle text-foreground rounded px-1.5 py-0.5 font-mono">
          {credentials.email}
        </code>
        <code className="bg-background-subtle text-foreground rounded px-1.5 py-0.5 font-mono">
          {credentials.password}
        </code>
      </div>
      {/*
        Prefill button: ships `hidden` and carries the demo credentials on
        `data-demo-*`. The inline script after `</details>` unhides it ONLY on
        a page with an auth login form, and wires it to fill the two inputs
        (fill-only — never submits). A quiet secondary button in the same
        neutral/dark token language as the rest of the panel chrome.

        It sits on its OWN row below the chips (not inside the flex-wrap
        row): an action mixed into wrapping data drifts to wherever the
        wrap leaves space, so its position would change with credential
        length. A fixed row keeps the panel's reading order stable —
        data first, then the one action on it.
      */}
      <button
        type="button"
        hidden
        data-testid="demo-notice-prefill"
        data-demo-email={credentials.email}
        data-demo-password={credentials.password}
        className="border-border text-foreground-muted hover:text-foreground mt-1.5 rounded border px-2 py-1 text-xs font-medium transition-colors"
      >
        {labels.prefill}
      </button>
    </div>
  )
}

function DemoNoticePanel({
  config,
  labels,
}: {
  readonly config: DemoNoticeDisplayConfig
  readonly labels: DemoNoticeLabels
}): Readonly<ReactElement> {
  // `w-72` (not wider): the round-2 body is one short sentence, and at this
  // width it wraps BEFORE "04:00 UTC" — keeping the time and its unit on one
  // line instead of orphaning "UTC." on its own line.
  return (
    <div className="border-border bg-background-raised text-foreground-muted mb-2 hidden w-72 max-w-full rounded-lg border p-3 text-xs shadow-sm group-open:block">
      {/*
        Both paragraphs pin `text-xs` on the element itself. The CSS compiler's
        base layer emits `p { … text-base }`, which — although the panel wrapper
        sets `text-xs` — wins over the INHERITED size on the `<p>`. A utility on
        the element beats the base layer, so the body renders at 12px (the
        round-1 defect was the body paragraph inheriting 16px from that rule).
      */}
      <p className="text-foreground text-xs font-semibold">{labels.title(config.name)}</p>
      <p className="mt-1 text-xs leading-relaxed">{labels.body}</p>
      {config.credentials && (
        <DemoNoticeCredentials
          credentials={config.credentials}
          labels={labels}
        />
      )}
      {/*
        CTA touch target: `py-1` grows the hit area to ~24px; `mt-1` (not mt-2)
        keeps the VISUAL gap at 8px since the padding now contributes 4px, and
        `-mb-1` cancels the padding's bottom growth against the panel edge.
        Deliberately avoids stacking `-my-1` with an `mt-*` utility — both
        target margin-top, and which wins depends on generated-CSS order, not
        class order.
      */}
      {config.url && (
        <a
          href={config.url}
          target="_blank"
          rel="noopener"
          data-testid="demo-notice-cta"
          className="text-foreground-muted hover:text-foreground mt-1 -mb-1 inline-block py-1 font-medium underline underline-offset-2 transition-colors"
        >
          {labels.cta}
        </a>
      )}
    </div>
  )
}

/**
 * The demo context notice — a small persistent panel fixed bottom-LEFT on every
 * page of a Sovrium demo instance, telling a visitor that they are on a public
 * demo of a Sovrium template, that its data resets nightly, which credentials to
 * sign in with, and where the template's product page lives.
 *
 * Design contract (mirrors `ui/badge/sovrium-badge.tsx` — do not relitigate):
 * - Pure SSR: a native `<details>` disclosure, no island, no client JS, no
 *   hydration. Collapse/expand is the browser's own `<summary>` behaviour, which
 *   also carries full keyboard and screen-reader semantics without authored ARIA.
 * - Fixed bottom-LEFT at `z-40` (below the `z-50` dialog/skip-link layer). The
 *   badge holds bottom-RIGHT, so the two chrome elements never collide.
 * - Hidden in print (`print:hidden`), same as the badge.
 * - Contrast-safe in light and dark via the SAME neutral design-token scale the
 *   badge uses, so notice and badge read as one chrome system rather than two
 *   unrelated overlays.
 * - Copy follows the page's active locale (en/fr, English fallback) via
 *   {@link getDemoNoticeLabels}; it is platform chrome, not app content.
 *
 * Gating is env-only and self-contained: the component reads the process-wide
 * {@link getDemoNoticeDisplayConfig} and renders `null` when the master switch
 * is off. Unlike the badge — whose toggle comes from per-app config and must
 * therefore be threaded down as a prop — this value is a process constant, so
 * gating inside the component keeps every injection site a single line and makes
 * it structurally impossible for one surface to drift out of sync with another.
 *
 * When disabled the component emits NOTHING: no wrapper, no copy, and critically
 * no demo credential or demo URL anywhere in the served HTML. An app cloned from
 * a template must be indistinguishable from one that never had this compiled in.
 */
export function DemoNotice({
  lang,
}: {
  /** The page's active locale (e.g. `'en'`, `'fr'`); English fallback when undefined. */
  readonly lang?: string
}): Readonly<ReactElement> | null {
  const config = getDemoNoticeDisplayConfig()
  // eslint-disable-next-line unicorn/no-null -- React components must return null (not undefined) to render nothing
  if (!config) return null

  const labels = getDemoNoticeLabels(lang)

  return (
    <>
      <details
        data-testid="demo-notice"
        open={true}
        className="group fixed bottom-3 left-3 z-40 flex w-fit max-w-[calc(100vw-1.5rem)] flex-col-reverse items-start print:hidden"
      >
        {/*
          `flex-col-reverse` renders the panel visually ABOVE the pill while keeping
          `<summary>` first in DOM order (which `<details>` requires, and which is
          also the correct reading order for keyboard and screen-reader users).
          The reason is an interaction one: the element is anchored to the viewport
          by its BOTTOM edge, so with the panel in normal flow below the summary,
          expanding pushed the pill upward — the control jumped out from under the
          pointer mid-click. Reversing the visual order pins the pill to
          `bottom-3` so it is a stationary target in both states, and the panel
          grows upward into empty space.
        */}
        <DemoNoticeSummary label={labels.summary} />
        <DemoNoticePanel
          config={config}
          labels={labels}
        />
      </details>
      {/*
        The credential-prefill script is emitted ONLY when a credentials block
        (and thus the prefill button) is present. It carries no credential in its
        body — the values live on the button's `data-demo-*` attributes — so a
        credentialless or disabled notice leaks nothing.
      */}
      {config.credentials && (
        <script
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only, static prefill script; never re-renders client-side
          dangerouslySetInnerHTML={{ __html: DEMO_NOTICE_PREFILL_SCRIPT }}
        />
      )}
    </>
  )
}
