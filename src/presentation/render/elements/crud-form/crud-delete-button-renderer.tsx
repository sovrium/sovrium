/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `crud` delete button: a host the crud-form island mounts its delete view
 * into, with a server-drawn button standing in until it does. Split out of
 * `crud-form-renderer.tsx` so that file stays under its size ceiling.
 *
 * The button's in-flight word arrives on the props as
 * `data-action-pending-label` — resolved in the page language by the button
 * schema overlay (`button-pending-label.ts`), the action's own `pendingLabel`
 * first — and rides into the island props rather than onto the host. Its
 * resting word, when it declares no `content`, arrives the same way.
 *
 * Who is offered the button at all is the page's CRUD gate
 * (`page-crud-gating.tsx`), from the table's `permissions.delete`.
 */

import { type ReactElement } from 'react'
import {
  CONFIRM_AFFIRM_LABEL_ATTR,
  CONFIRM_CANCEL_LABEL_ATTR,
} from '@/domain/models/app/pages/confirm-gate-labels'
import { omitInternalMarkers } from '../../props/internal-marker-props'
import {
  DELETE_LABEL_ATTR,
  DELETE_WORDS_ATTR,
  FAILURE_LABEL_ATTR,
  PENDING_LABEL_ATTR,
  RATE_LIMIT_LABEL_ATTR,
} from '../button-pending-label'
import { buildCrudIslandProps } from './crud-form-island-props'
import type { ElementProps } from '../html-element-renderer'
import type { CrudFormAction } from './crud-form-types'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'

type DeleteButtonConfig = {
  readonly props: ElementProps
  readonly content: string | undefined
  readonly action: CrudFormAction
  readonly routeParams?: RouteParams
}

function buildDeleteButtonAttrs(action: CrudFormAction): Record<string, unknown> {
  return {
    'data-action-type': 'crud',
    'data-action-method': 'delete',
    'data-action-table': action.table,
    ...(action.onSuccess?.navigate && { 'data-on-success-redirect': action.onSuccess.navigate }),
    ...(action.confirm && { 'data-confirm': 'true' }),
    ...(action.confirmMessage && { 'data-confirm-message': action.confirmMessage }),
  }
}

/**
 * The delete's words in the page language, as the server stamped them: a
 * rate-limit refusal, any other failure, and the confirmation, its Cancel and
 * the line once the record is gone.
 */
function deleteUiStrings(refusal: unknown, failure: unknown, words: unknown) {
  if (typeof refusal !== 'string') return {}
  return {
    uiStrings: {
      'rateLimit.retryIn': refusal,
      ...(typeof failure === 'string' && { 'form.operationFailed': failure }),
      ...(typeof words === 'string' && (JSON.parse(words) as Readonly<Record<string, string>>)),
    },
  }
}

/**
 * The button's own `confirm` — a string prompt or the object form, stamped on
 * the props by the button schema overlay — as the gate the delete view draws
 * before it deletes. Undefined when the button asks nothing of its own.
 */
function buttonConfirmGate(
  configAttr: unknown,
  promptAttr: unknown
): Readonly<Record<string, unknown>> | undefined {
  if (typeof configAttr === 'string') {
    const parsed = JSON.parse(configAttr) as unknown
    if (parsed !== null && typeof parsed === 'object') return parsed as Record<string, unknown>
  }
  return typeof promptAttr === 'string' ? { message: promptAttr } : undefined
}

/** The gate and its page-language Cancel word, as the island reads them. */
function gateIslandProps(
  confirmGate: Readonly<Record<string, unknown>> | undefined,
  cancelLabel: unknown
): { confirmGate?: Readonly<Record<string, unknown>>; confirmCancelLabel?: string } {
  if (confirmGate === undefined) return {}
  return typeof cancelLabel === 'string'
    ? { confirmGate, confirmCancelLabel: cancelLabel }
    : { confirmGate }
}

/** The button's resting word: its `content`, then its `label`, then the page-language default. */
function restingWord(content: string | undefined, ownLabel: unknown, fallback: unknown): string {
  if (content !== undefined) return content
  if (typeof ownLabel === 'string') return ownLabel
  return typeof fallback === 'string' ? fallback : 'Delete'
}

export function renderCrudDeleteButton(config: DeleteButtonConfig): ReactElement {
  const { props, content, action, routeParams } = config
  const record = (props._record ?? {}) as Record<string, unknown>
  const {
    [PENDING_LABEL_ATTR]: pendingLabel,
    [DELETE_LABEL_ATTR]: restingLabel,
    [RATE_LIMIT_LABEL_ATTR]: refusalLabel,
    [FAILURE_LABEL_ATTR]: failureLabel,
    [DELETE_WORDS_ATTR]: deleteWords,
    label: ownLabel,
    'data-label': _dataLabel,
    'data-confirm-config': confirmConfig,
    'data-confirm': confirmPrompt,
    'data-confirm-label': _confirmLabel,
    'data-confirm-class': _confirmClass,
    [CONFIRM_AFFIRM_LABEL_ATTR]: _affirmLabel,
    [CONFIRM_CANCEL_LABEL_ATTR]: cancelLabel,
    ...restProps
  } = omitInternalMarkers(props) as Record<string, unknown>
  const label = restingWord(content, ownLabel, restingLabel)
  const recordId = String(record['id'] ?? routeParams?.['id'] ?? '')
  const islandProps = buildCrudIslandProps({
    operation: 'delete',
    action,
    fields: [],
    recordId,
    testId: restProps['data-testid'],
    id: restProps['id'],
    buttonLabel: label,
    ...(typeof pendingLabel === 'string' ? { pendingLabel } : {}),
    ...deleteUiStrings(refusalLabel, failureLabel, deleteWords),
    ...gateIslandProps(buttonConfirmGate(confirmConfig, confirmPrompt), cancelLabel),
  })
  const buttonAttrs = buildDeleteButtonAttrs(action)

  return (
    <div
      {...(restProps as ElementProps)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      <button {...buttonAttrs}>{label}</button>
    </div>
  )
}
