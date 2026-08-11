/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  buildAuthDataAttributes,
  buildAutomationDataAttributes,
  buildClickDataAttributes,
  buildFetchDataAttributes,
  buildRecordContext,
  isAuthAction,
  isAutomationAction,
  isCrudDeleteAction,
  isFetchAction,
  resolveInputDataRecordVars,
  type AuthButtonAction,
  type AutomationAction,
  type FetchAction,
} from './button-action-builders'
import { renderCrudDeleteButton } from './crud-form/crud-form-renderer'
import type { ElementProps } from './html-element-renderer'
import type { Tables } from '@/domain/models/app/tables'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'

/**
 * Render an action-bearing button: strips the synthetic `label` / `_record` /
 * `_dataSourceBound` props, resolves the visible content (content → children →
 * label fallback), and merges the action's data attributes onto the element.
 * Shared by the automation / auth / fetch renderers so each stays a one-liner.
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
    _record: _rec,
    _dataSourceBound: _dsb,
    ...restProps
  } = props as Record<string, unknown>
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
 * Renders an auth-action button (e.g. logout) with data attributes for
 * client-side handling.
 */
function renderAuthButton(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  action: AuthButtonAction
): ReactElement {
  return renderActionButton(props, content, children, buildAuthDataAttributes(action))
}

/**
 * Renders a fetch action button with data attributes for client-side handling
 */
function renderFetchButton(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  action: FetchAction
): ReactElement {
  return renderActionButton(props, content, children, buildFetchDataAttributes(action))
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

const LoadingSpinner = (
  <svg
    className="animate-spin"
    data-loading="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      opacity="0.25"
    />
    <path
      fill="currentColor"
      opacity="0.75"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
)

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
 * Renders button element with click interactions
 */
// eslint-disable-next-line complexity -- dispatches across 7 action types (crud-delete/automation/auth/fetch/navigate/loading/default); each branch is a one-liner. Threshold is 10; renderButton exceeds it after the GAP-H2 'auth' branch was added.
export function renderButton({
  props,
  content,
  children,
  interactions,
  action,
  tables,
  routeParams,
  loading,
}: RenderButtonOptions): ReactElement {
  if (isCrudDeleteAction(action)) {
    return renderCrudDeleteButton({ props, content, action, tables, routeParams })
  }

  if (isAutomationAction(action)) {
    return renderAutomationButton({ props, content, children, action, routeParams })
  }

  if (isAuthAction(action)) {
    return renderAuthButton(props, content, children, action)
  }

  if (isFetchAction(action)) {
    return renderFetchButton(props, content, children, action)
  }

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
  const { label: _label, 'data-label': _dataLabel, ...restProps } = props as Record<string, unknown>

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
