/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parts the mirrored sign-in and sign-up screens (`login-*`, `signup-*`)
 * are composed from, each named after the shadcn/ui part it draws and carrying
 * that part's `data-slot` (`card`, `card-header`, `field-separator`…), so an
 * operator styling them reads the same names shadcn's docs use.
 *
 * Where shadcn draws its inputs, the screens put the app's own auth forms: the
 * engine draws the email and password fields, checks them and signs the reader
 * in, so no block re-implements a credential form. Every other way in is gated
 * on what the app DECLARES, as the `auth-*` blocks are.
 */

import { ifDeclared, unlessDeclared } from './auth-block-kit'
import { passwordForm, providerList, socialButtons } from './login-block-forms'
import type { BlockNode } from './block-kit'

export { magicLinkForm, signUpForm } from './login-block-forms'

// ─── Parts ────────────────────────────────────────────────────────────────

export const text = (
  element: string,
  content: string,
  className: string,
  slot = ''
): BlockNode => ({
  type: 'text',
  element,
  props: { className, ...(slot === '' ? {} : { 'data-slot': slot }) },
  content,
})

/**
 * shadcn's Card. The surface — ground, edge, radius — is the `card` type's own,
 * so it follows the app's `design`; the block sets only the rhythm inside:
 * 16 px between the parts, the parts padding themselves.
 */
export const card = (children: readonly BlockNode[], className = ''): BlockNode => ({
  type: 'card',
  props: {
    'data-slot': 'card',
    className: `flex flex-col gap-4 overflow-hidden px-0 py-4 text-sm ${className}`.trim(),
  },
  children,
})

/** CardHeader with its CardTitle and CardDescription. */
export const cardHeader = (title: string, description: string, centred: boolean): BlockNode => ({
  type: 'container',
  props: {
    'data-slot': 'card-header',
    className: `grid auto-rows-min gap-1 px-4 ${centred ? 'text-center' : ''}`.trim(),
  },
  children: [
    text(
      'h1',
      title,
      `font-medium leading-snug text-foreground ${centred ? 'text-xl' : 'text-base'}`,
      'card-title'
    ),
    text('p', description, 'text-sm text-muted-foreground', 'card-description'),
  ],
})

export const cardContent = (children: readonly BlockNode[], className = 'px-4'): BlockNode => ({
  type: 'container',
  props: { 'data-slot': 'card-content', className },
  children,
})

/** FieldGroup: the column the form, its links and its alternatives stack in. */
export const fieldGroup = (children: readonly BlockNode[], className = ''): BlockNode => ({
  type: 'flex',
  props: {
    'data-slot': 'field-group',
    className: `flex w-full flex-col gap-5 ${className}`.trim(),
  },
  children,
})

/** The heading of a screen without a card: an h1 and the sentence under it. */
export const bareHeader = (title: string, description: string, gap = 'gap-1'): BlockNode => ({
  type: 'flex',
  props: { className: `flex flex-col items-center ${gap} text-center` },
  children: [
    text('h1', title, 'text-2xl font-bold text-foreground'),
    text('p', description, 'text-sm text-balance text-muted-foreground'),
  ],
})

/** FieldSeparator: a hairline either side of its label. */
export const fieldSeparator = (label: string): BlockNode => ({
  type: 'flex',
  props: {
    'data-slot': 'field-separator',
    className: 'flex h-5 items-center gap-2 text-sm text-muted-foreground',
  },
  children: [
    { type: 'separator', props: { className: 'flex-1' } },
    text('span', label, 'shrink-0 px-2', 'field-separator-content'),
    { type: 'separator', props: { className: 'flex-1' } },
  ],
})

/** FieldDescription ending in a link — "Don't have an account? Sign up". */
export const descriptionLink = (
  sentence: string,
  label: string,
  href: string,
  extra = ''
): BlockNode => ({
  type: 'flex',
  props: {
    'data-slot': 'field-description',
    className: `flex flex-wrap justify-center gap-1 text-sm text-muted-foreground ${extra}`.trim(),
  },
  children: [
    text('span', sentence, ''),
    {
      type: 'link',
      props: { href, className: 'underline underline-offset-4 hover:text-primary' },
      content: label,
    },
  ],
})

/** The app's mark: a small primary square holding the icon, then the app's name. */
export const brand = (iconName: string, className: string): BlockNode => ({
  type: 'link',
  props: {
    href: '/',
    className: `flex items-center gap-2 text-sm font-medium text-foreground ${className}`.trim(),
  },
  children: [
    {
      type: 'container',
      props: {
        className:
          'flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground',
      },
      children: [{ type: 'icon', props: { name: iconName, size: 16 } }],
    },
    { type: 'text', element: 'span', content: '$app.label' },
  ],
})

/** The terms line under the form, drawn only when both addresses are set. */
export const termsLine = (termsPath: string, privacyPath: string): readonly BlockNode[] =>
  termsPath.trim() === '' || privacyPath.trim() === ''
    ? []
    : [
        {
          type: 'flex',
          props: {
            'data-slot': 'field-description',
            className:
              'flex flex-wrap justify-center gap-1 px-6 text-center text-sm text-muted-foreground',
          },
          children: [
            text('span', 'By continuing, you agree to our', ''),
            {
              type: 'link',
              props: { href: termsPath, className: 'underline underline-offset-4' },
              content: 'Terms of Service',
            },
            text('span', 'and', ''),
            {
              type: 'link',
              props: { href: privacyPath, className: 'underline underline-offset-4' },
              content: 'Privacy Policy',
            },
          ],
        },
      ]

/**
 * The cover beside the form: the image when one is set, else the muted panel
 * shadcn draws behind its placeholder. Hidden below `breakpoint`, as shadcn's is.
 */
export const cover = (src: string, breakpoint: 'md' | 'lg'): BlockNode => {
  const shown = breakpoint === 'md' ? 'md:block' : 'lg:block'
  return {
    type: 'container',
    props: { className: `relative hidden min-h-64 bg-muted ${shown}` },
    children:
      src.trim() === ''
        ? []
        : [
            {
              type: 'image',
              props: {
                src,
                alt: '',
                loading: 'lazy',
                className:
                  'absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale',
              },
            },
          ],
  }
}

/** The page ground every centred screen sits on. */
export const ground = (children: readonly BlockNode[], className: string): BlockNode => ({
  type: 'container',
  element: 'section',
  props: {
    className:
      `flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10 ${className}`.trim(),
  },
  children,
})

// ─── One screen's reading of its parameters ──────────────────────────────

/** What a screen reads: its resolved parameters. */
export interface Screen {
  readonly p: (key: string) => string
}

/** "Don't have an account? Sign up", drawn while sign-up is open. */
export const signUpLine = ({ p }: Screen): BlockNode =>
  ifDeclared('auth.signUp', descriptionLink("Don't have an account?", 'Sign up', p('signUpPath')))

/** "Already have an account? Sign in". */
export const signInLine = ({ p }: Screen): BlockNode =>
  descriptionLink('Already have an account?', 'Sign in', p('signInPath'))

/**
 * The email-and-password form. Its "Forgot your password?" is the form's own,
 * drawn in the Password label row when one of the app's pages sends the reset
 * link.
 */
export const passwordColumn = ({ p }: Screen): readonly BlockNode[] => [
  passwordForm('Sign in', p('successPath'), p('twoStepPath')),
]

/** The social buttons for the screen's `providers`, in shadcn's column or a given grid. */
export const socials = (
  { p }: Screen,
  verb: string,
  layout: { readonly className?: string; readonly compact?: boolean } = {}
): readonly BlockNode[] =>
  socialButtons({ providers: p('providers'), verb, successPath: p('successPath'), ...layout })

/** The labelled separator above the social buttons, drawn only when there are some. */
export const orSeparator = ({ p }: Screen, label: string): readonly BlockNode[] =>
  providerList(p('providers')).length === 0 ? [] : [ifDeclared('auth.oauth', fieldSeparator(label))]

/** The terms line for the screen's `termsPath` and `privacyPath`. */
export const terms = ({ p }: Screen): readonly BlockNode[] =>
  termsLine(p('termsPath'), p('privacyPath'))

/** What a sign-up screen draws instead of its form once the app closes sign-up. */
export const closedNotice = (s: Screen): BlockNode =>
  unlessDeclared('auth.signUp', {
    type: 'flex',
    props: { className: 'flex flex-col gap-4 text-center' },
    children: [
      text('h1', 'Sign-up is closed', 'text-xl font-bold text-foreground'),
      text('p', s.p('closedMessage'), 'text-sm text-balance text-muted-foreground'),
      signInLine(s),
    ],
  })

/**
 * Draw `nodes` only while sign-up is open. They are wrapped rather than each
 * gated, so a node keeping its own gate — a social button's `auth.oauth` —
 * keeps it; the wrapper is `contents`, so the column's rhythm still spaces them.
 */
export const openOnly = (nodes: readonly BlockNode[]): readonly BlockNode[] => [
  ifDeclared('auth.signUp', {
    type: 'container',
    props: { className: 'contents' },
    children: nodes,
  }),
]

/** An alternative way in that lives on its own page, drawn as shadcn's outline button. */
export const outlineLink = (label: string, href: string): BlockNode => ({
  type: 'link',
  props: {
    href,
    'data-slot': 'button',
    className:
      'inline-flex h-8 w-full items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted',
  },
  content: label,
})
