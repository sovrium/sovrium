/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `/_admin/design-system/preview/:section` — the specimen documents the console
 * embeds, one per section.
 *
 * ─── WHY THESE RENDER AS THE OPERATOR'S APP AND NOT AS A CONSOLE SURFACE ────
 *
 * Every other `/_admin` path resolves to a surface app spread from the EMBEDDED
 * console config, which is what keeps the console wearing Sovrium's chrome.
 * A preview must do the exact opposite: it exists to show the operator's theme,
 * so it is built from the OPERATOR's app and carries the operator's name.
 *
 * That one fact drives the whole stylesheet routing for free.
 * `isOperatorConsoleApp` is false here, so `getVersionedCssPath` mints the
 * operator's hash, and the CSS route serves the operator's compiled stylesheet
 * — the same bytes their own pages get. Nothing scopes, overrides or re-scopes
 * anything: the preview simply IS the app, in its own document.
 *
 * ─── WHY AN IFRAME IS THE ISOLATION, AND THE ONLY ISOLATION ─────────────────
 *
 * Admin chrome and app theme both want `:root`. A document boundary is the only
 * thing that gives them one each. Any CSS-scoping machinery invented to avoid
 * the iframe would also have to reproduce the cascade faithfully enough that
 * the preview still could not lie — at which point it is a second renderer, and
 * a second renderer is exactly what a design system must not have.
 *
 * ─── WHAT IS DELIBERATELY NOT CARRIED OVER ──────────────────────────────────
 *
 * The preview app is built field by field rather than spread from the operator
 * app. `tables`, `env`, `auth`, `automations` and everything else stay behind,
 * so [internal ref] A2's confidentiality bound holds BY CONSTRUCTION rather than by a
 * redaction pass that someone has to remember to extend.
 */

import { buildDesignSystem } from '@/application/use-cases/admin/design-system'
import { foundationsSection } from './design-system-foundation-specimens'
import { uiKitSection, voiceSection } from './design-system-specimen-sections'
import type { PreviewScheme } from './design-system-foundation-specimens'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The v1 sections. One preview document each — never one per component.
 *
 * The 89 component-types and 49 field-types are a later, mechanical phase:
 * shipping three readable sections beats shipping a catalogue nobody scrolls.
 *
 * ─── THE ORDER IS THE READING ORDER, AND IT IS DELIBERATE ───────────────────
 *
 * Tokens, then tokens assembled, then the rules that govern both. A reader
 * arriving at a system they did not author recognises a palette by looking at
 * it, believes it once they see it composed into a surface, and only then has
 * a reason to read prose about it. `ui-kit` sits in the middle for a second
 * reason: it is the only one of the three that comes close to fitting the
 * console's frame, so it is the panel that rewards a reader who has not yet
 * decided to open anything full-page.
 *
 * The array order drives the console's panel order and nothing else — the
 * route guard tests MEMBERSHIP via `isDesignSystemPreviewSection`, so a
 * reordering can never change which paths resolve.
 */
export const DESIGN_SYSTEM_PREVIEW_SECTIONS = ['foundations', 'ui-kit', 'voice'] as const

/** One of the v1 preview sections. */
export type DesignSystemPreviewSection = (typeof DESIGN_SYSTEM_PREVIEW_SECTIONS)[number]

/**
 * Human-readable titles, used for the specimen's own heading and the iframe title.
 *
 * `ui-kit` is titled "Tokens in use" and not "UI kit" ON PURPOSE. This section
 * is four hand-composed surfaces made of `container` / `text` / `card`, and it
 * reads no config at all. A real kit — every component-type rendered by the
 * real renderer — is a later phase, and shipping a page called "UI kit" now
 * would leave two things wearing that name, with the weaker one holding it.
 * The SLUG stays `ui-kit`: the route is already linkable, and renaming a URL
 * to fix a heading is a cost paid by every reader who bookmarked it.
 */
export const DESIGN_SYSTEM_SECTION_TITLES: Readonly<Record<DesignSystemPreviewSection, string>> = {
  foundations: 'Foundations',
  'ui-kit': 'Tokens in use',
  voice: 'Voice and usage',
}

/** One line saying what each section is for, shown under its heading. */
const SECTION_SUMMARIES: Readonly<Record<DesignSystemPreviewSection, string>> = {
  // It may now name the SCHEME, which it deliberately could not before: the
  // document is single-mode, so a dark preview used to paint dark and print the
  // light value, and "at the value it resolves to" was a sentence the page
  // itself disproved under `?scheme=dark`.
  foundations:
    'Every token this app renders with, drawn at the value it resolves to in the scheme you are reading.',
  'ui-kit': 'The same tokens composed into surfaces, so a combination can be judged on sight.',
  voice:
    'The rules a writer follows here: what this app believes, how it addresses a reader, and what each colour is for.',
}

/** Whether a string names a v1 preview section. */
export const isDesignSystemPreviewSection = (value: string): value is DesignSystemPreviewSection =>
  (DESIGN_SYSTEM_PREVIEW_SECTIONS as readonly string[]).includes(value)

/**
 * Compose the section body for a preview.
 *
 * The SCHEME reaches `foundationsSection` and nothing else, because it is the
 * only section that prints token VALUES. This is the seam the dark-mode defect
 * lived on: the document was built once, from the light cascade, while
 * `?scheme=dark` flipped a separate object that drove only the CSS — so the
 * page repainted and its labels did not.
 */
const sectionBody = (
  section: DesignSystemPreviewSection,
  operatorApp: App,
  scheme: PreviewScheme
): readonly Component[] => {
  if (section === 'ui-kit') return uiKitSection()
  const document = buildDesignSystem(operatorApp)
  return section === 'voice' ? voiceSection(document) : foundationsSection(document, scheme)
}

/**
 * The specimen page for one section.
 *
 * `bg-background text-foreground` sits on the OUTERMOST element deliberately:
 * the preview must paint the app's real page surface, not float on whatever the
 * browser defaults to, and putting it first also makes the app's own background
 * the first painted thing in the document.
 */
const previewPage = (
  section: DesignSystemPreviewSection,
  path: string,
  operatorApp: App,
  scheme: PreviewScheme
): Page =>
  ({
    id: `design-system-preview-${section}`,
    name: `design-system-preview-${section}`,
    path,
    meta: { title: `Design system — ${DESIGN_SYSTEM_SECTION_TITLES[section]}`, lang: 'en-US' },
    components: [
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'bg-background text-foreground flex min-h-screen flex-col gap-6 p-6',
          'data-testid': 'preview-surface',
        },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-1' },
            children: [
              {
                type: 'text',
                element: 'h1',
                props: { className: 'text-foreground text-xl font-semibold tracking-tight' },
                content: DESIGN_SYSTEM_SECTION_TITLES[section],
              },
              {
                type: 'text',
                element: 'p',
                props: { className: 'text-foreground-subtle max-w-2xl text-sm leading-relaxed' },
                content: SECTION_SUMMARIES[section],
              },
            ],
          },
          ...sectionBody(section, operatorApp, scheme),
        ],
      } as unknown as Component,
    ],
  }) as Page

/**
 * Build the app that renders one preview document.
 *
 * @param operatorApp - the live operator app; the source of BOTH the theme this
 *   preview paints with and the design system it describes.
 * @param section - the requested v1 section.
 * @param path - the `/_admin`-stripped request path the page must answer on.
 * @param scheme - the `?scheme` query. `dark` sets `theme.colorScheme`, which
 *   is what emits the existing no-FOUC head script — the same one every themed
 *   Sovrium page uses, so the preview flips exactly the way a real page does.
 *   Deliberately a REQUEST parameter and not a stored preference: it must never
 *   persist a scheme onto the operator's console session.
 */
export const buildDesignSystemPreviewApp = (
  operatorApp: App,
  section: DesignSystemPreviewSection,
  path: string,
  scheme?: string
): App => {
  const theme = operatorApp.design?.theme ?? operatorApp.theme
  const isDark = scheme === 'dark'
  const themed = isDark ? { ...theme, colorScheme: 'dark' as const } : theme

  return {
    // The OPERATOR's name, which is what routes this document to the operator's
    // stylesheet rather than the console's. Not cosmetic.
    name: operatorApp.name,
    // Both positions, because the renderer reads `app.theme` while the
    // design-system generator reads `design`.
    theme: themed,
    design: { ...operatorApp.design, theme: themed },
    // A specimen is Sovrium's own documentation surface, not a generated app
    // page: no "Built with Sovrium" badge, and no auto-appended record palette
    // (which would mount a search island inside a document that has no records).
    badge: false,
    palette: { enabled: false },
    pages: [previewPage(section, path, operatorApp, isDark ? 'dark' : 'light')],
  } as unknown as App
}
