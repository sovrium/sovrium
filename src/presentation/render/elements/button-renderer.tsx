/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { renderSpinnerMark } from '@/presentation/design/spinner-mark'
import { openImportTable } from '@/presentation/render/resolve/open-import-gate'
import { omitInternalMarkers } from '../props/internal-marker-props'
import {
  buildAutomationDataAttributes,
  buildClickDataAttributes,
  buildFetchDataAttributes,
  buildToastDataAttributes,
  buildRecordContext,
  isAutomationAction,
  isCrudDeleteAction,
  isFetchAction,
  isToastAction,
  resolveInputDataRecordVars,
  type AutomationAction,
} from './button-action-builders'
import { buildAuthDataAttributes, isAuthAction } from './button-auth-action'
import { buildEditSelectAttributes } from './button-edit-select'
import { buildNavigateClick, isNavigateAction } from './button-navigate-action'
import {
  buildFillDataAttributes,
  buildSeekDataAttributes,
  isFillAction,
  isSeekAction,
} from './button-page-action-builders'
import {
  buttonPressAttributes,
  buttonRecordControlOf,
  renderRecordDisabledButton,
  type ButtonRecordControl,
} from './button-record-control'
import { renderCrudDeleteButton } from './crud-form/crud-delete-button-renderer'
import { renderOpenImportButton } from './open-import-button'
import type { ElementProps } from './html-element-renderer'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Only the client runtime dispatches an action button, and that runtime is a
 * lazily imported chunk that can land after the page is on screen: a press
 * before it ran did nothing at all — no confirm, no request. So the button is
 * drawn disabled and marked until the runtime enables it
 * (`islands/runtime/awaiting-script-controls.ts`). A button the author drew
 * disabled is left as authored: the runtime would otherwise enable it.
 */
const AWAITING_SCRIPT_ATTRS = { disabled: true, 'data-awaits-script': '' } as const

/**
 * Render an action-bearing button: strips the synthetic `label` prop and the
 * internal data-source markers, resolves the visible content (content →
 * children → label fallback), and merges the action's data attributes onto the
 * element. Shared by the automation / auth / fetch renderers so each stays a
 * one-liner.
 *
 * The marker strip goes through `omitInternalMarkers` rather than naming keys:
 * destructuring only `_record` and `_dataSourceBound` would leave `_readOnly` on
 * a button inside a read-only CRUD form, and React would warn. Naming keys here
 * means re-finding this function every time the resolve pipeline gains a marker.
 */
function renderActionButton(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  actionAttrs: Record<string, string>
): ReactElement {
  const label = (props.label ?? props['data-label']) as string | undefined
  const {
    label: _label,
    'data-label': _dataLabel,
    ...restProps
  } = omitInternalMarkers(props) as Record<string, unknown>
  const buttonContent = content || (children.length > 0 ? children : undefined) || label
  // When a destructive `confirm` prompt gates this button (overlaid onto the
  // element props as `data-confirm` by the schema-fallback layer), expose the
  // button's visible label as `data-confirm-label` so the client confirm-gate
  // re-uses it as the in-dialog confirm affordance — the standalone-button
  // analog of the data-table per-row `action-cell.tsx` confirm.
  const confirmLabelSource = content ?? label
  const confirmLabel =
    typeof restProps['data-confirm'] === 'string' && typeof confirmLabelSource === 'string'
      ? confirmLabelSource
      : undefined
  return (
    <button
      {...restProps}
      {...actionAttrs}
      {...(confirmLabel ? { 'data-confirm-label': confirmLabel } : {})}
      {...(restProps.disabled ? {} : AWAITING_SCRIPT_ATTRS)}
    >
      {buttonContent}
    </button>
  )
}

type RenderButtonOptions = {
  readonly props: ElementProps
  readonly content: string | undefined
  readonly children: readonly React.ReactNode[]
  readonly interactions?: unknown
  readonly action?: unknown
  readonly routeParams?: RouteParams
  readonly loading?: boolean
  /** The page language, which an `openImport` button's dialog words follow. */
  readonly lang?: { readonly currentLang?: string; readonly languages?: Languages }
  /** The button's own config node, which carries its record control (`button-record-control.tsx`). */
  readonly component?: Readonly<Record<string, unknown>>
}

/**
 * Renders an automation action button with data attributes for client-side handling
 */
function renderAutomationButton(opts: {
  readonly props: ElementProps
  readonly content: string | undefined
  readonly children: readonly React.ReactNode[]
  readonly action: AutomationAction
  readonly routeParams: RouteParams | undefined
  readonly control: ButtonRecordControl | undefined
}): ReactElement {
  const { props, content, children, action, routeParams, control } = opts
  const boundRecord = (props as { _record?: Readonly<Record<string, unknown>> })._record
  const recordContext = buildRecordContext(boundRecord, routeParams)
  const resolvedInputData = action.inputData
    ? resolveInputDataRecordVars(action.inputData, recordContext)
    : undefined
  return renderActionButton(props, content, children, {
    ...buildAutomationDataAttributes(action, resolvedInputData, recordContext),
    ...(control === undefined ? {} : buttonPressAttributes(control)),
  })
}

/**
 * The data attributes of an action the client runtime runs from the button
 * alone — auth (logout), fetch, toast, fill and seek — or `undefined` for any
 * other. A fill's `value`, and a seek's `target` and `time`, are resolved here
 * against the record the button is drawn for (the row of a list template, or
 * the page's bound record and route).
 */
function clientActionAttributes(
  action: unknown,
  props: ElementProps,
  routeParams: RouteParams | undefined
): Record<string, string> | undefined {
  if (isAuthAction(action)) return buildAuthDataAttributes(action)
  if (isFetchAction(action)) return buildFetchDataAttributes(action)
  if (isToastAction(action)) return buildToastDataAttributes(action)
  if (!isFillAction(action) && !isSeekAction(action)) return undefined
  const boundRecord = (props as { _record?: Readonly<Record<string, unknown>> })._record
  const record = buildRecordContext(boundRecord, routeParams)
  return isFillAction(action)
    ? buildFillDataAttributes(action, record)
    : buildSeekDataAttributes(action, record)
}

/**
 * The loading spinner the button draws beside its label.
 *
 * The mark itself lives in `design/spinner-mark`, shared with the `spinner`
 * component type and every pending control — see `design/spinner-mark-markup.ts`
 * for why the arc is shaped and weighted the way it is, and for why its 16px is
 * an intrinsic floor rather than a size. Held as a module constant so the
 * button's loading branch allocates nothing per render.
 */
const LoadingSpinner = renderSpinnerMark()

/**
 * Renders a disabled button with a spinner for loading state
 */
function renderLoadingButton(
  buttonProps: Record<string, unknown>,
  buttonContent: React.ReactNode
): ReactElement {
  return (
    <button
      {...buttonProps}
      disabled
    >
      {LoadingSpinner}
      {buttonContent}
    </button>
  )
}

/**
 * The action-less button: its click interactions ride in data attributes for
 * the client runtime, and `loading` swaps in the spinner variant.
 */
function renderPlainButton({
  props,
  content,
  children,
  interactions,
  loading,
}: Pick<
  RenderButtonOptions,
  'props' | 'content' | 'children' | 'interactions' | 'loading'
>): ReactElement {
  const interactionsTyped = interactions as
    | {
        click?: {
          animation?: string
          navigate?: string
          openUrl?: string
          openInNewTab?: boolean
          scrollTo?: string
          toggleElement?: string
          submitForm?: string
          modal?: string
        }
      }
    | undefined
  const clickInteraction = interactionsTyped?.click

  // Extract label from props as fallback button text
  const label = (props.label ?? props['data-label']) as string | undefined
  // The plain (action-less) button is a DOM boundary like any other: a button
  // inside a data-bound container carries the markers too, and this branch used
  // to strip none of them.
  const {
    label: _label,
    'data-label': _dataLabel,
    ...restProps
  } = omitInternalMarkers(props) as Record<string, unknown>

  // Store interaction data in data attributes for client-side JavaScript handler
  const buttonProps = clickInteraction
    ? { ...restProps, ...buildClickDataAttributes(clickInteraction) }
    : restProps

  const buttonContent = content || (children.length > 0 ? children : undefined) || label

  if ('href' in buttonProps) return renderButtonLink(buttonProps, buttonContent)

  if (loading) {
    return renderLoadingButton(buttonProps, buttonContent)
  }

  return <button {...buttonProps}>{buttonContent}</button>
}

/**
 * A button with `props.href` is a link drawn as a button: an `<a>` keeping the
 * button's part attributes and recipe, its `target` and `rel`. The address may
 * come from a record, so it is drawn only when `toSafeAssetUrl` admits it — a
 * path on this site or an `http(s)` address; anything else (`javascript:`
 * included) leaves the anchor with no address at all. A new-tab link the
 * author gave no `rel` opens with `noopener noreferrer`, so the destination
 * gets no handle on the app's tab.
 */
function renderButtonLink(
  buttonProps: Record<string, unknown>,
  buttonContent: React.ReactNode
): ReactElement {
  const { href, type: _type, disabled: _disabled, ...linkProps } = buttonProps
  const safeHref = toSafeAssetUrl(href)
  const defaultRel = linkProps['target'] === '_blank' && linkProps['rel'] === undefined
  return (
    <a
      {...linkProps}
      {...(defaultRel && { rel: 'noopener noreferrer' })}
      {...(safeHref !== undefined && { href: safeHref })}
    >
      {buttonContent}
    </a>
  )
}

/**
 * Renders button element with click interactions
 */
export function renderButton(options: RenderButtonOptions): ReactElement {
  const { props, content, children } = options
  // Disabled on its record by the server's verdict: drawn with no action at all.
  const control = buttonRecordControlOf(options.component, props, options.lang)
  if (control?.disabled !== true) return renderUsableButton(options, control)
  const label = (props.label ?? props['data-label']) as string | undefined
  const buttonContent = content || (children.length > 0 ? children : undefined) || label
  return renderRecordDisabledButton(props, buttonContent, control)
}

/** The action verbs that open an overlay by id: the button is that overlay's trigger. */
const OVERLAY_OPENING_VERBS: ReadonlySet<string> = new Set(['openSheet', 'openDialog'])

/** A button its record does not disable, by what its action is. */
function renderUsableButton(
  options: RenderButtonOptions,
  control: ButtonRecordControl | undefined
): ReactElement {
  const { props, content, children, action, routeParams } = options
  if (isCrudDeleteAction(action)) {
    return renderCrudDeleteButton({ props, content, action, routeParams })
  }

  if (isAutomationAction(action)) {
    return renderAutomationButton({ props, content, children, action, routeParams, control })
  }

  // A navigate button is a plain button the always-shipped click enhancer moves
  // the reader with — no runtime to wait for, so it is never drawn disabled.
  if (isNavigateAction(action)) {
    const boundRecord = (props as { _record?: Readonly<Record<string, unknown>> })._record
    const click = buildNavigateClick(action, buildRecordContext(boundRecord, routeParams))
    return renderPlainButton({ ...options, interactions: click && { click } })
  }

  // An `openSheet` / `openDialog` button is the overlay's own trigger, as a click
  // interaction naming its id is.
  const sheet = (action as { action?: unknown; component?: unknown } | undefined) ?? {}
  if (OVERLAY_OPENING_VERBS.has(String(sheet.action)) && typeof sheet.component === 'string') {
    return renderPlainButton({ ...options, interactions: { click: { modal: sheet.component } } })
  }

  const importTable = openImportTable({ action })
  if (importTable !== undefined)
    return renderOpenImportButton(importTable, props, content, options.lang)

  const clientAttrs = clientActionAttributes(action, props, routeParams)
  if (clientAttrs !== undefined) {
    // A picker opens before the action runs: the client reads it off the button.
    const picker = buildEditSelectAttributes(action, options.component, options.lang)
    return renderActionButton(props, content, children, { ...clientAttrs, ...picker })
  }

  return renderPlainButton(options)
}
