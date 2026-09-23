/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The public operator sign-in surface.
//
// The ONLY unguarded page under the console's base: the auth seam exempts
// `/_admin/login` so an anonymous operator can sign in, while the base itself
// stays 404-anonymous (standing rule S1). That carve-out is an EXACT-MATCH set,
// never a prefix — a prefix would expose the console.
//
// PATHS ARE MOUNT-RELATIVE (`/login`, `/forgot-password`, `/`). The mount
// primitive prefixes them with the console's base at render time, so `/login` is
// what is authored here and `/_admin/login` is what an operator visits.
//
// Mirrors the business-app login pattern one-to-one: a centred card holding a
// `form`/`auth`/`login`/`email` action that renders through the shared
// `auth-form` island, submits to Better Auth `POST /api/auth/sign-in/email`,
// and returns the operator to the console root on success.

import type { Page as PageConfig } from '@/domain/models/app'

export default {
  id: 'dashboard-login',
  name: 'dashboard-login',
  path: '/login',
  meta: {
    title: '$t:admin.meta.login',
    noindex: true,
  },
  components: [
    // The page renderer already wraps every page in a single `<main
    // id="main-content">` (PageMain), so this uses a plain `div` — an
    // `element: 'main'` here would create a SECOND `main` landmark and break
    // `getByRole('main')` strict-mode resolution (a11y: one main per page).
    {
      type: 'container',
      element: 'div',
      props: {
        // The console root as THIS document sees it, mount-relative like every
        // other link on the page. The mount primitive rewrites it to the real
        // base, which is how the client islands on an unauthenticated page —
        // the sign-in form's password-reset callback above all — learn which
        // mount they are being served from.
        'data-admin-base-path': '/',
        className:
          'min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-16 bg-background text-foreground',
      },
      children: [
        {
          type: 'container',
          props: { className: 'flex flex-col items-center gap-3 text-center' },
          children: [
            // ─── THE MARK ─────────────────────────────────────────────────
            //
            // Decided on the canvas, round 8: the element mark, tile-less, at
            // 36px. What stood here was a literal `S` in a filled square, which
            // is neither the mark nor the operator's app — and a container the
            // mark's own rules forbid ("no tile, no container, no second ink").
            //
            // TWO images rather than one, because the mark must invert with the
            // colour scheme and an `<img>` cannot do that from a single file: an
            // SVG loaded through `src` renders in its OWN document, so it never
            // sees this page's `currentColor` and never reaches its webfonts
            // either. The `-outline` files are the font-independent pair — paths,
            // not live text — so they draw identically on every machine.
            //
            // The paths are ABSOLUTE and engine-served. The console is mounted
            // inside somebody else's app, so a page-relative path would resolve
            // against the HOSTING app's `public/` and 404 in every real
            // deployment; the engine answers these at the root, the way it
            // already answers the design-system console's sample media.
            //
            // `src` and `alt` ride in `props`, not at the top level: a child of
            // a container accepts only `type`, `props`, `interactions`,
            // `responsive`, `visibility` and `variant`, and the validator
            // refuses a bare `src` here by name.
            {
              type: 'image',
              props: {
                src: '/assets/brand/sovrium/mark-light-outline.svg',
                alt: 'Sovrium',
                className: 'block h-9 w-9 shrink-0 dark:hidden',
              },
            },
            {
              type: 'image',
              props: {
                src: '/assets/brand/sovrium/mark-dark-outline.svg',
                alt: 'Sovrium',
                className: 'hidden h-9 w-9 shrink-0 dark:block',
              },
            },
            {
              type: 'text',
              element: 'h1',
              content: '$t:admin.login.heading',
              props: {
                className: 'text-3xl font-bold tracking-tight leading-tight text-foreground',
              },
            },
            // ─── "The operator console for <the operator's app>." ──────────
            //
            // THREE nodes for one sentence, and the reason is an ordering the
            // config surface does not advertise: `$app.label` resolves inside a
            // literal `content`, and NOT inside the value a `$t:` token
            // resolves to. The app-vars pass has already run by the time the
            // translation is substituted, so a token written into the
            // translated string survives to the page and prints verbatim —
            // measured here on 2026-09-18, where `'The operator console for
            // $app.label.'` rendered with the token as text.
            //
            // Nothing shipped had hit it, because every other use of an
            // `$app.*` token in this console is a node of its OWN
            // (`sidebar.ts:170`, the breadcrumb's `home.label`) rather than a
            // word inside a sentence. So the sentence is composed the way the
            // platform already supports: translated lead, bound name, full
            // stop. The lead keeps its trailing space — it is a sentence
            // fragment, not a label.
            //
            // A `text` takes no children, so the three are siblings under a
            // `container`. They are inline spans, so they flow as one line of
            // prose and wrap as one.
            //
            // `element: 'div'`, not `'p'`: a container's element is a closed set
            // of block landmarks and the validator refuses `p` by name. The
            // paragraph here is a subtitle under the heading, not prose, so the
            // tag carries no meaning the styling does not already carry.
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'text-md leading-relaxed text-foreground-muted max-w-sm',
                'data-testid': 'login-blurb',
              },
              children: [
                { type: 'text', element: 'span', content: '$t:admin.login.blurb' },
                {
                  type: 'text',
                  element: 'span',
                  content: '$app.label',
                  props: { className: 'text-foreground font-medium' },
                },
                { type: 'text', element: 'span', content: '.' },
              ],
            },
          ],
        },
        {
          type: 'card',
          props: {
            className: 'w-full max-w-sm bg-background-raised border border-border rounded-lg p-8',
          },
          children: [
            {
              type: 'form',
              props: { id: 'admin-login-form' },
              action: {
                type: 'auth',
                method: 'login',
                strategy: 'email',
                // The console speaks English, and so does its sign-in form.
                // "Sign in" is stated explicitly rather than left to the shared
                // `auth-form` island's default so it stays paired with the
                // operator menu's "Sign out" — one concept, one word, and the
                // pair should never drift apart. This is a per-form i18n config
                // of that SHARED island: `fields[]` overrides target a field by
                // `name` and replace its visible label; the email/password input
                // types are unchanged.
                submitLabel: '$t:admin.login.submit',
                // In-flight label — threaded to the shared auth-form island like
                // submitLabel so the pending button never falls back to a
                // hardcoded "Loading...".
                pendingLabel: '$t:admin.login.pending',
                fields: [
                  { name: 'email', label: '$t:admin.field.email' },
                  { name: 'password', label: '$t:admin.field.password' },
                ],
                onSuccess: {
                  navigate: '/',
                },
              },
            },
            // Recovery entry point. A `link`
            // primitive, NOT a second auth form: the card stacks its children, so
            // this sits under the submit button. Platform-pruned from the rendered
            // tree when SMTP is unconfigured — a dead link is worse than none.
            {
              type: 'link',
              props: {
                href: '/forgot-password',
                className: 'text-md text-center mt-4 text-foreground-muted',
              },
              content: '$t:admin.login.forgotLink',
            },
          ],
        },
      ],
    },
  ],
} satisfies PageConfig
