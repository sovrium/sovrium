/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The anatomy every AUTH block shares: the app's mark and name, one `h1`, one
 * sentence saying what happens next, the form, an "or" divider, alternatives
 * as secondary buttons, and a footer link.
 *
 * The card is 384 px wide (416 for an invitation) on the page ground, with a
 * hairline border and no shadow. Below the `sm` breakpoint the card dissolves
 * into the page — no border, no padding of its own — so a phone shows the
 * content from the top with the page's 16 px gutter rather than a box floating
 * in the middle of a small screen.
 *
 * Every alternative sign-in way is gated on what the app DECLARES
 * (`visibility.declares`), so a block installed into an app without passkeys
 * draws no passkey button rather than a button that fails.
 */

import type { BlockNode } from './block-kit'

/** The capabilities an auth block can gate a region on. */
export type AuthCapability =
  | 'auth.passkeys'
  | 'auth.magicLink'
  | 'auth.oauth'
  | 'auth.sso'
  | 'auth.signUp'
  | 'auth.twoFactor'
  | 'auth.apiKeys'

/** Draw `node` only when the app declares `capability`. */
export const ifDeclared = (capability: AuthCapability, node: BlockNode): BlockNode => ({
  ...node,
  visibility: { declares: capability },
})

/** Draw `node` only when the app does NOT declare `capability`. */
export const unlessDeclared = (capability: AuthCapability, node: BlockNode): BlockNode => ({
  ...node,
  visibility: { unlessDeclares: capability },
})

/** The app's mark and name above the heading. */
export const appMark = (iconName: string): BlockNode => ({
  type: 'flex',
  props: { className: 'flex items-center gap-2 text-sm font-semibold text-foreground' },
  children: [
    {
      type: 'icon',
      props: {
        name: iconName,
        size: 14,
        className: 'box-content rounded-sm bg-primary p-1 text-primary-foreground',
      },
    },
    { type: 'text', element: 'span', content: '$app.label' },
  ],
})

/** The one heading of an auth page and the sentence under it. */
export const authHeading = (title: string, sentence: string): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-col gap-1.5' },
  children: [
    {
      type: 'text',
      element: 'h1',
      props: { className: 'text-2xl font-semibold tracking-tight text-foreground' },
      content: title,
    },
    ...(sentence === ''
      ? []
      : [
          {
            type: 'text',
            element: 'p',
            props: { className: 'text-md text-foreground-muted' },
            content: sentence,
          },
        ]),
  ],
})

/** A hairline either side of a small "or". */
export const orDivider = (): BlockNode => ({
  type: 'flex',
  props: {
    className: 'flex items-center gap-3 text-sm text-foreground-subtle',
    role: 'separator',
  },
  children: [
    { type: 'container', props: { className: 'h-px flex-1 bg-border' } },
    { type: 'text', element: 'span', content: 'or' },
    { type: 'container', props: { className: 'h-px flex-1 bg-border' } },
  ],
})

/** A sentence ending in a link — "No account yet? Create one". */
export const footerLink = (sentence: string, label: string, href: string): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-wrap gap-1 text-md text-foreground-muted' },
  children: [
    ...(sentence === '' ? [] : [{ type: 'text', element: 'span', content: sentence }]),
    {
      type: 'link',
      props: { href, className: 'font-medium text-foreground underline underline-offset-4' },
      content: label,
    },
  ],
})

/** A plain link on its own line, for "Forgot password?" and its kin. */
export const quietLink = (label: string, href: string): BlockNode => ({
  type: 'link',
  props: {
    href,
    className: 'self-start text-md text-foreground-muted underline underline-offset-4',
  },
  content: label,
})

/**
 * The page and the card: centred on the page ground at `sm` and up; on a phone
 * the card has no frame and the content starts at the top.
 */
export const authPage = (children: readonly BlockNode[], wide = false): BlockNode => ({
  type: 'container',
  element: 'main',
  props: {
    className:
      'flex min-h-screen justify-center bg-background-subtle px-4 pt-10 pb-12 sm:items-center sm:px-6',
  },
  children: [
    {
      type: 'container',
      props: {
        className: `flex w-full ${wide ? 'max-w-104' : 'max-w-96'} flex-col gap-6 self-start sm:self-auto sm:rounded-lg sm:border sm:border-border sm:bg-background-raised sm:p-8`,
      },
      children,
    },
  ],
})

/** The note every auth block carries on the ways it draws. */
export const AUTH_GATE_NOTE =
  'Each alternative way in is drawn only when your `auth` config offers it: a passkey button when `passkeys` is on, a single sign-on link when `sso` lists a provider, and so on. Turn one on in `auth` and the block shows it; turn it off and it disappears, with no edit to the block.'

/** The note every auth block carries on where to place it. */
export const AUTH_PLACE_NOTE =
  'Place it alone on a page — `components: [{ component: <name> }]` — since it draws the whole screen, ground included. Pages under `/sign-in`, `/sign-up` and `/reset-password` are the addresses the built-in emails and redirects point to.'

/** One variant of an auth screen, stacked at the card's own rhythm. */
export const authColumn = (children: readonly BlockNode[]): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-col gap-6' },
  children,
})

/** A link drawn as a secondary button, for an alternative way in that lives on its own page. */
export const alternativeLink = (label: string, href: string): BlockNode => ({
  type: 'link',
  props: {
    href,
    className:
      'inline-flex h-8 w-full items-center justify-center rounded-md border border-border-strong bg-background-raised text-base font-medium text-foreground hover:bg-background-subtle',
  },
  content: label,
})
