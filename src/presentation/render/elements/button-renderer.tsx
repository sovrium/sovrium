/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { omitInternalMarkers } from '../props/internal-marker-props'
import {
  buildAuthDataAttributes,
  buildAutomationDataAttributes,
  buildClickDataAttributes,
  buildFetchDataAttributes,
  buildFillDataAttributes,
  buildToastDataAttributes,
  buildRecordContext,
  isAuthAction,
  isAutomationAction,
  isCrudDeleteAction,
  isFetchAction,
  isFillAction,
  isToastAction,
  resolveInputDataRecordVars,
  type AutomationAction,
} from './button-action-builders'
import { buildNavigateClick, isNavigateAction } from './button-navigate-action'
import { renderCrudDeleteButton } from './crud-form/crud-form-renderer'
import { renderSpinnerMark } from './spinner-mark'
import type { ElementProps } from './html-element-renderer'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { Tables } from '@/domain/models/app/tables'

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
  readonly tables?: Tables
  readonly routeParams?: RouteParams
  readonly loading?: boolean
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
}): ReactElement {
  const { props, content, children, action, routeParams } = opts
  const boundRecord = (props as { _record?: Readonly<Record<string, unknown>> })._record
  const recordContext = buildRecordContext(boundRecord, routeParams)
  const resolvedInputData = action.inputData
    ? resolveInputDataRecordVars(action.inputData, recordContext)
    : undefined
  return renderActionButton(
    props,
    content,
    children,
    buildAutomationDataAttributes(action, resolvedInputData)
  )
}

/**
 * The data attributes of an action the client runtime runs from the button
 * alone — auth (logout), fetch, toast and fill — or `undefined` for any other.
 * A fill's `value` is resolved here against the record the button is drawn for
 * (the row of a list template, or the page's bound record and route).
 */
function clientActionAttributes(
  action: unknown,
  props: ElementProps,
  routeParams: RouteParams | undefined
): Record<string, string> | undefined {
  if (isAuthAction(action)) return buildAuthDataAttributes(action)
  if (isFetchAction(action)) return buildFetchDataAttributes(action)
  if (isToastAction(action)) return buildToastDataAttributes(action)
  if (!isFillAction(action)) return undefined
  const boundRecord = (props as { _record?: Readonly<Record<string, unknown>> })._record
  return buildFillDataAttributes(action, buildRecordContext(boundRecord, routeParams))
}

/**
 * The loading spinner the button draws beside its label.
 *
 * The mark itself moved to `./spinner-mark` when the `spinner` component type
 * gained a renderer of its own — see that file for why the arc is shaped and
 * weighted the way it is, and for why its 16px is an intrinsic floor rather
 * than a size. Held as a module constant, as it was before, so the button's
 * loading branch allocates nothing per render.
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

  if (loading) {
    return renderLoadingButton(buttonProps, buttonContent)
  }

  return <button {...buttonProps}>{buttonContent}</button>
}

/**
 * Renders button element with click interactions
 */
export function renderButton(options: RenderButtonOptions): ReactElement {
  const { props, content, children, action, tables, routeParams } = options
  if (isCrudDeleteAction(action)) {
    return renderCrudDeleteButton({ props, content, action, tables, routeParams })
  }

  if (isAutomationAction(action)) {
    return renderAutomationButton({ props, content, children, action, routeParams })
  }

  // A navigate button is a plain button the always-shipped click enhancer moves
  // the reader with — no runtime to wait for, so it is never drawn disabled.
  if (isNavigateAction(action)) {
    const boundRecord = (props as { _record?: Readonly<Record<string, unknown>> })._record
    const click = buildNavigateClick(action, buildRecordContext(boundRecord, routeParams))
    return renderPlainButton({ ...options, interactions: click && { click } })
  }

  const clientAttrs = clientActionAttributes(action, props, routeParams)
  if (clientAttrs !== undefined) {
    return renderActionButton(props, content, children, clientAttrs)
  }

  return renderPlainButton(options)
}
