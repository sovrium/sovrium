/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The sidebar's foot: the operator identity menu, pinned below the scrolling
// nav (see `sidebar.ts`).

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The operator identity footer.
 *
 * ─── THE TRIGGER NAMES ITS HOLDER, AND IS ANNOUNCED BY ITS FUNCTION ────────
 *
 * Two different names, deliberately. `triggerLabel` is the ACCESSIBLE name and
 * stays a verb — a control announced as a person tells a screen-reader user who
 * they are rather than what the control does. The children are what a sighted
 * reader sees: their picture, their name, their address.
 *
 * ─── NOTHING HERE IS IN THE SERVED BYTES ───────────────────────────────────
 *
 * Every value is a `$session.` binding resolved CLIENT-SIDE from
 * `GET /api/auth/get-session`. The server draws an unresolved token as an
 * ABSENCE rather than as text, which is the half that matters: a token left in
 * visible copy is merely ugly, while the same token in `src` is fetched as a
 * relative URL and painted as a broken image — and an identity in the served
 * bytes would let a cached page serve one caller's name to the next.
 *
 * The avatar's chain is ordered and that is the feature: a picture if the
 * account has one, the caller's own initials from `$session.name` if it does
 * not. An operator who never uploaded a photograph gets a readable disc rather
 * than a broken one, without this file writing the fallback.
 *
 * The build-version line the island drew in the menu FOOTER is still gone, for
 * a reason that has not changed: `dropdown-menu` has no `footerContent`. The
 * chip beside the brand already prints `$app.version`.
 */
export const operatorMenu: PageComponent = {
  type: 'dropdown-menu',
  triggerLabel: '$t:admin.shell.account',
  props: {
    // `md:max-xl:[&>svg]:hidden` drops the chevron under the rail, which is
    // what the reference board draws: at 56px the row is the avatar and
    // nothing else, centred. The chevron is the affordance for a label it no
    // longer sits beside, so at that width it is decoration in the only place
    // with no room for any — and it is `aria-hidden`, so hiding it visually
    // costs a screen reader nothing. The trigger keeps its accessible name
    // from `triggerLabel`.
    //
    // It has to be an arbitrary child variant because the chevron is drawn by
    // the component, not by this config: there is no node here to put a class
    // on. The full-width sidebar keeps it.
    className:
      'border-border text-foreground-subtle hover:text-foreground mt-auto w-full border-t px-2 pt-3 text-left text-md md:max-xl:justify-center md:max-xl:px-0 md:max-xl:[&>svg]:hidden',
    'data-testid': 'operator-menu',
  },
  children: [
    {
      type: 'avatar',
      size: 'sm',
      src: '$session.image',
      label: '$session.name',
      props: { 'data-testid': 'operator-avatar' },
    },
    // The name and the address go under the rail; the avatar stays, and the
    // trigger keeps its own accessible name (`triggerLabel`), so the control
    // is still announced as what it does rather than as who is signed in.
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-w-0 flex-col text-left md:max-xl:hidden' },
      children: [
        {
          type: 'text',
          element: 'span',
          session: 'name',
          props: {
            className: 'text-foreground truncate text-sm font-medium',
            'data-testid': 'operator-name',
          },
        },
        {
          type: 'text',
          element: 'span',
          session: 'email',
          props: {
            className: 'text-foreground-muted truncate text-[11px]',
            'data-testid': 'operator-email',
          },
        },
      ],
    },
  ],
  menuItems: [
    { label: '$t:admin.shell.myAccount', action: { type: 'navigate', path: '/profile' } },
    { separator: true },
    {
      label: '$t:admin.shell.giveFeedback',
      action: {
        type: 'navigate',
        path: 'https://github.com/sovrium/sovrium/issues/new?labels=feedback',
      },
    },
    {
      label: '$t:admin.shell.reportBug',
      action: {
        type: 'navigate',
        path: 'https://github.com/sovrium/sovrium/issues/new?labels=bug',
      },
    },
    { separator: true },
    {
      label: '$t:admin.shell.signOut',
      variant: 'destructive',
      action: { type: 'auth', method: 'logout', onSuccess: { navigate: '/login' } },
    },
  ],
} as PageComponent
