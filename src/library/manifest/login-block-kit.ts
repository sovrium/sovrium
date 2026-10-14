/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The five screens shadcn/ui's sign-in and sign-up blocks are drawn on, and the
 * parameters and notes the ten mirrors (`login-01`…`05`, `signup-01`…`05`)
 * share. Each screen takes the column of parts a block composes (see
 * `login-block-parts.ts`) and places it as shadcn's block of that number does:
 * a card on the page ground, two columns with a cover, a card on a muted
 * ground, a wide card split with a cover, or a bare column.
 */

import { stringParam, THEME_NOTE } from './block-kit'
import { brand, card, cover, fieldGroup, ground, terms, text } from './login-block-parts'
import type { BlockNode } from './block-kit'
import type { LibraryParam } from './define'
import type { Screen } from './login-block-parts'

// ─── Parameters ────────────────────────────────────────────────────────────

const COMMON_PARAMS: readonly LibraryParam[] = [
  stringParam('iconName', 'The icon drawn in the app mark.', 'gallery-vertical-end'),
  stringParam('successPath', 'Where a signed-in reader lands.', '/'),
  stringParam(
    'termsPath',
    'Your terms of service page. Set it with `privacyPath` to draw the terms line under the form.',
    ''
  ),
  stringParam(
    'privacyPath',
    'Your privacy policy page. Set it with `termsPath` to draw the terms line under the form.',
    ''
  ),
]

const IMAGE_PARAM = stringParam(
  'imageSrc',
  'The cover image beside the form. Empty draws the muted panel in its place.',
  ''
)

const providersParam = (fallback: string): LibraryParam =>
  stringParam(
    'providers',
    'The social providers offered, comma-separated, each one your `auth` config lists (google, github, microsoft, slack, gitlab). Empty draws none.',
    fallback
  )

export const loginParams = (
  providers: string,
  options: { readonly image?: boolean; readonly extra?: readonly LibraryParam[] } = {}
): readonly LibraryParam[] => [
  ...COMMON_PARAMS,
  providersParam(providers),
  stringParam('signUpPath', 'The sign-up page, linked while sign-up is open.', '/sign-up'),
  stringParam(
    'resetPath',
    'The password-reset page, linked when one of your pages sends the reset link.',
    '/reset-password'
  ),
  stringParam(
    'twoStepPath',
    'The page an account with two-step on is sent to for its code: the `auth-two-factor` block.',
    '/two-step'
  ),
  ...(options.image === true ? [IMAGE_PARAM] : []),
  ...(options.extra ?? []),
]

/** The alternatives `login-03` gathers, each on its own page. */
export const ALTERNATIVE_PARAMS: readonly LibraryParam[] = [
  stringParam(
    'magicLinkPath',
    'The magic-link page, linked when that way in is on.',
    '/magic-link'
  ),
  stringParam('ssoPath', 'The single sign-on page, linked when a provider is set.', '/sso'),
]

/** The password sign-in page `login-05` links back to. */
export const SIGN_IN_PARAM: LibraryParam = {
  ...stringParam('signInPath', 'The password sign-in page, linked under the form.', '/sign-in'),
  defaultFromConfig: 'auth.loginPage',
}

export const signupParams = (
  providers: string,
  options: { readonly image?: boolean } = {}
): readonly LibraryParam[] => [
  ...COMMON_PARAMS,
  providersParam(providers),
  {
    ...stringParam(
      'signInPath',
      'The sign-in page, linked for readers who already have an account.',
      '/sign-in'
    ),
    defaultFromConfig: 'auth.loginPage',
  },
  stringParam(
    'closedMessage',
    'What a reader is told when your app has closed sign-up.',
    'New accounts are by invitation. Ask the person who runs this app to invite you.'
  ),
  ...(options.image === true ? [IMAGE_PARAM] : []),
]

// ─── Notes ─────────────────────────────────────────────────────────────────

export const MIRROR_NOTE =
  "Mirrors the shadcn/ui block of the same id: the same layout and parts, with your app's own sign-in forms where shadcn draws its inputs. Install it with `sovrium library add`, as you would add the block with `npx shadcn add`."

export const LOGIN_NOTES: readonly string[] = [
  MIRROR_NOTE,
  'Place it alone on a page — `components: [{ component: <name> }]` — since it draws the whole screen, ground included.',
  'Each social button is drawn only when your `auth` config offers social sign-in, one per provider listed in `providers`; "Forgot your password?" only when one of your pages sends the reset link; the sign-up line only while sign-up is open.',
  'The terms line is drawn once both `termsPath` and `privacyPath` are set.',
  THEME_NOTE,
]

export const SIGNUP_NOTES: readonly string[] = [
  MIRROR_NOTE,
  'Place it alone on a page — `components: [{ component: <name> }]` — since it draws the whole screen, ground included.',
  'When your app closes sign-up (`auth.allowSignUp: false`) the form is not drawn: the screen says sign-up is closed and links to sign-in. Open it again and the form comes back.',
  'Each social button is drawn only when your `auth` config offers social sign-in, one per provider listed in `providers`. The terms line is drawn once both `termsPath` and `privacyPath` are set.',
  THEME_NOTE,
]

// ─── Screens ───────────────────────────────────────────────────────────────

/** `-01`: one card centred on the page. */
export const centredCardScreen = (children: readonly BlockNode[]): BlockNode =>
  ground([card(children, 'w-full max-w-sm')], '')

/** `-02`: the mark and the column on one side, the cover on the other from `lg`. */
export const coverScreen = ({ p }: Screen, column: readonly BlockNode[]): BlockNode => ({
  type: 'container',
  element: 'section',
  props: { className: 'grid min-h-svh w-full lg:grid-cols-2' },
  children: [
    {
      type: 'flex',
      props: { className: 'flex flex-col gap-4 p-6 md:p-10' },
      children: [
        brand(p('iconName'), 'self-center md:self-start'),
        {
          type: 'flex',
          props: { className: 'flex flex-1 items-center justify-center' },
          children: [fieldGroup(column, 'max-w-xs')],
        },
      ],
    },
    cover(p('imageSrc'), 'lg'),
  ],
})

/** `-03`: the mark above a card on a muted ground, the terms line under it. */
export const mutedCardScreen = (s: Screen, cardChildren: readonly BlockNode[]): BlockNode =>
  ground(
    [
      {
        type: 'flex',
        props: { className: 'flex w-full max-w-sm flex-col gap-6' },
        children: [brand(s.p('iconName'), 'self-center'), card(cardChildren), ...terms(s)],
      },
    ],
    'bg-muted'
  )

/** `-04`: one wide card on a muted ground, the column on one half, the cover on the other. */
export const splitCardScreen = (s: Screen, column: readonly BlockNode[]): BlockNode =>
  ground(
    [
      {
        type: 'flex',
        props: { className: 'flex w-full max-w-sm flex-col gap-6 md:max-w-4xl' },
        children: [
          card(
            [
              {
                type: 'grid',
                props: { 'data-slot': 'card-content', className: 'grid p-0 md:grid-cols-2' },
                children: [fieldGroup(column, 'p-6 md:p-8'), cover(s.p('imageSrc'), 'md')],
              },
            ],
            'p-0'
          ),
          ...terms(s),
        ],
      },
    ],
    'bg-muted'
  )

/** `-05`: no card — the mark, a welcome heading and its line, then the column. */
export const bareScreen = (s: Screen, line: BlockNode, column: readonly BlockNode[]): BlockNode =>
  ground(
    [
      {
        type: 'flex',
        props: { className: 'flex w-full max-w-sm flex-col gap-6' },
        children: [
          fieldGroup([
            {
              type: 'flex',
              props: { className: 'flex flex-col items-center gap-2 text-center' },
              children: [
                {
                  type: 'link',
                  props: {
                    href: '/',
                    'aria-label': '$app.label',
                    className: 'flex size-8 items-center justify-center rounded-md text-foreground',
                  },
                  children: [
                    {
                      type: 'icon',
                      props: { name: s.p('iconName'), size: 24, className: 'size-6' },
                    },
                  ],
                },
                text('h1', 'Welcome to $app.label', 'text-xl font-bold text-foreground'),
                line,
              ],
            },
            ...column,
          ]),
          ...terms(s),
        ],
      },
    ],
    'bg-background'
  )

/** The row the split screens draw their social buttons in: one column per provider. */
export const COMPACT_ROW = 'grid auto-cols-fr grid-flow-col gap-4'
