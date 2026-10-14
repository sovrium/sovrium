/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `alert` SSR renderer — shadcn/ui's Alert anatomy.
 *
 *   <div data-slot="alert" role="alert" data-variant>
 *     <svg/>                                   the variant's icon
 *     <div data-slot="alert-title"/>           when `title` is set
 *     <div data-slot="alert-description"/>     `content`, else the children
 *     <div data-slot="alert-action">           when `props.dismissible`
 *       <button aria-label="Dismiss"/>
 *     </div>
 *   </div>
 *
 * The variant is `alertVariant`, else the older top-level `variant`, else
 * `props.variant`. The
 * `props` bag still reaches the root as it always has, so `props.variant`
 * stays an attribute there and an app's `design.colors.<variant>` (with its
 * `<variant>-light` ground) still tints an alert that names it that way.
 *
 * The close button toggles the alert through the page's delegated
 * `data-click-toggle-element` script, targeting a server-minted id: there is
 * no island and nothing to hydrate.
 */

import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import {
  computeAlertActionClasses,
  computeAlertClasses,
  computeAlertDescriptionClasses,
  computeAlertTitleClasses,
  type AlertVariant,
} from '@/presentation/design/alert-default-classes'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { buildAlertVariantStyles } from '../elements/html-element-helpers'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

const ALERT_VARIANTS: ReadonlySet<string> = new Set<AlertVariant>([
  'default',
  'destructive',
  'warning',
  'info',
  'success',
])

/** Each tone's icon: the glyph is what tells the four card-coloured tones apart. */
const ALERT_ICON: Readonly<Record<AlertVariant, LucideIcon>> = {
  default: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleAlert,
}

/**
 * `alertVariant`, else the older top-level `variant`, else `props.variant`;
 * `default` when none of them names a tone.
 */
const variantOf = (component: Record<string, unknown>, propsVariant: unknown): AlertVariant => {
  const raw = component['alertVariant'] ?? component['variant'] ?? propsVariant
  return typeof raw === 'string' && ALERT_VARIANTS.has(raw) ? (raw as AlertVariant) : 'default'
}

/** The close button, in the corner the base string pads for. */
function dismissAction(alertId: string): ReactElement {
  return (
    <div
      data-slot="alert-action"
      className={computeAlertActionClasses()}
    >
      <button
        type="button"
        aria-label="Dismiss"
        data-click-toggle-element={`[data-alert-id="${alertId}"]`}
        className={computePartButtonClasses({ variant: 'ghost', size: 'icon-xs' })}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * The title row, when the alert names one. `title` is read off the component,
 * never the `props` bag (where it would be the native tooltip attribute), so
 * its `$t:` key is resolved here: the pipeline substitutes `props` only.
 */
function titleOf(
  title: unknown,
  lang: string | undefined,
  languages: Languages | undefined
): ReactElement | undefined {
  if (typeof title !== 'string' || title === '') return undefined
  return (
    <div
      data-slot="alert-title"
      className={computeAlertTitleClasses()}
    >
      {resolveTranslationPattern(title, lang ?? languages?.default ?? '', languages)}
    </div>
  )
}

/** An app's `design.colors.<variant>` tint, under any author `style`; absent when neither. */
function styleOf(
  variant: unknown,
  design: Parameters<typeof buildAlertVariantStyles>[1],
  style: unknown
): { readonly style?: Record<string, unknown> } {
  const merged = {
    ...buildAlertVariantStyles(typeof variant === 'string' ? variant : undefined, design),
    ...((style as Record<string, unknown> | undefined) ?? {}),
  }
  return Object.keys(merged).length === 0 ? {} : { style: merged }
}

export const alertComponent: ComponentRenderer = ({
  elementProps,
  content,
  renderedChildren,
  design,
  component,
  currentLang,
  languages,
}) => {
  const c = (component ?? {}) as Record<string, unknown>
  const variant = variantOf(c, elementProps['variant'])
  const Icon = ALERT_ICON[variant]
  const { dismissible, className, style, ...domProps } = omitInternalMarkers(
    elementProps
  ) as Record<string, unknown>
  const alertId = dismissible === true ? crypto.randomUUID() : undefined
  return (
    <div
      {...domProps}
      {...(alertId === undefined ? {} : { 'data-alert-id': alertId })}
      data-slot="alert"
      data-variant={variant}
      role="alert"
      className={mergePrestyle(computeAlertClasses({ variant }), className as string | undefined)}
      {...styleOf(domProps['variant'], design, style)}
    >
      <Icon aria-hidden="true" />
      {titleOf(c['title'], currentLang, languages)}
      <div
        data-slot="alert-description"
        className={computeAlertDescriptionClasses()}
      >
        {content || renderedChildren}
      </div>
      {alertId === undefined ? undefined : dismissAction(alertId)}
    </div>
  )
}
