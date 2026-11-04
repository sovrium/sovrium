/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { resolveComponentStyle } from '@/presentation/design/resolve-component-classes'
import type { ComponentStyle, Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'

/** The engine string naming a persistent toast's close button. */
const TOAST_DISMISS_KEY = 'toast.dismiss'

/** A variant name safe to spell inside an attribute name. */
const ATTRIBUTE_SAFE_VARIANT = /^[a-z][a-z0-9-]*$/

/**
 * The close button's name in the page language: the author's
 * `sovrium.toast.dismiss` when there is one, else the engine's own word.
 */
export const resolveToastDismissName = (lang: string, languages: Languages | undefined): string =>
  resolveInterpreterString(TOAST_DISMISS_KEY, lang, languages)

/** The classes `design.components.toast` puts on one variant's toasts, root part folded. */
const toastVariantClasses = (design: Design, style: ComponentStyle): Record<string, string> =>
  Object.fromEntries(
    Object.keys(style.variants ?? {})
      .filter((variant) => ATTRIBUTE_SAFE_VARIANT.test(variant))
      .map((variant) => [
        `data-toast-class-${variant}`,
        resolveComponentStyle(design, 'toast', variant).root,
      ])
      .filter(([, classes]) => classes !== '')
  )

/**
 * What `<html>` tells every toast renderer about the toasts it builds.
 *
 * Toasts are built in the browser, by island modules and by inline scripts,
 * none of which can read the page's language or its `design`. So the server
 * writes both here, once per page, and every renderer reads them back from the
 * document element, whether or not the page drew a toast container:
 *
 *  - `data-toast-dismiss-label`: the close button's name, written only when it
 *    differs from the English default the renderers already fall back on, so an
 *    English page with no override is unchanged.
 *  - `data-toast-class`: `design.components.toast` for every toast, its root
 *    part and its states folded; `data-toast-class-<variant>` the same for one
 *    variant's toasts, with that variant's classes added. A renderer uses the
 *    variant's entry when there is one, else the general one.
 */
export function pageToastAttributes(
  design: Design | undefined,
  lang: string,
  languages: Languages | undefined
): Readonly<Record<string, string>> {
  const dismiss = resolveToastDismissName(lang, languages)
  const label: Record<string, string> =
    dismiss === resolveToastDismissName('en', undefined)
      ? {}
      : { 'data-toast-dismiss-label': dismiss }
  const style = (design?.components as Readonly<Record<string, ComponentStyle>> | undefined)?.[
    'toast'
  ]
  if (design === undefined || style === undefined) return label
  const { root } = resolveComponentStyle(design, 'toast')
  return {
    ...label,
    ...(root === '' ? {} : { 'data-toast-class': root }),
    ...toastVariantClasses(design, style),
  }
}
