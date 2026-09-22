/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SaveStatusIndicator } from '../../save-status-indicator'
import { ConflictToast } from '../conflict-toast'
import { WARNING_STRIP_CLASS } from '../warning-strip'
import type { StatusBannersProps } from '../view-props'

/**
 * A live connection that is stuck retrying, made visible.
 *
 * `data-connection-status` has always carried this state, but an attribute is
 * not an interface: a grid whose realtime transport had died — an expired
 * session, a proxy dropping long-lived connections — rendered identically to a
 * healthy one. A reader had no way to learn that the rows in front of them had
 * stopped updating, which is the worst kind of stale: silent and confident.
 *
 * `role="status"` rather than `role="alert"`, deliberately. Nothing is broken
 * and nothing has been lost — the reader's own edits still save over the
 * ordinary API — so this is a change of condition to announce politely, not an
 * error to interrupt for. `disconnected` gets the same banner: from the
 * reader's side, "still trying" and "gave up trying" have the same
 * consequence, a view that no longer refreshes itself.
 *
 * Nothing renders when the connection is healthy, and nothing renders when the
 * data source declares no realtime mode at all — the overwhelmingly common
 * case, where `connectionStatus` is `undefined`.
 */
function RealtimeConnectionBanner({
  status,
}: {
  readonly status: StatusBannersProps['connectionStatus']
}) {
  if (status !== 'reconnecting' && status !== 'disconnected') return undefined
  return (
    <div
      role="status"
      data-realtime-banner={status}
      className={WARNING_STRIP_CLASS}
    >
      Live updates are disconnected — reconnecting. This view may not show the latest changes.
    </div>
  )
}

/**
 * The alert strip above the toolbar: a stalled live connection, the floating
 * save indicator, a failed save, a refused save, and a realtime conflict.
 */
export function StatusBanners(props: StatusBannersProps) {
  return (
    <>
      <RealtimeConnectionBanner status={props.connectionStatus} />
      {props.showToastIndicator && props.indicatorStatus !== 'idle' && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50">
          <div className="border-border bg-background-overlay rounded-md border px-3 py-2 shadow-lg">
            <SaveStatusIndicator status={props.indicatorStatus} />
          </div>
        </div>
      )}
      {props.saveError && (
        <div
          role="alert"
          data-save-status="error"
          className="border-error-border bg-error-bg text-error-fg text-md flex items-center gap-3 border-b px-4 py-2"
        >
          <span>Error saving changes: {props.saveError}</span>
          {props.onRetrySave && (
            <button
              type="button"
              onClick={props.onRetrySave}
              className="border-error-border hover:bg-error-bg cursor-pointer rounded-sm border px-2 py-0.5 font-medium underline-offset-2 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {/*
        A refused save, not a failed one. It gets its own alert because the
        remedy differs: there is nothing to retry — the record moved on — so
        offering a retry control here would invite the user to walk into the
        same refusal. The wording names the conflict rather than describing a
        failure, since from the user's point of view nothing broke.
      */}
      {props.saveConflict && (
        <div
          role="alert"
          data-save-status="conflict"
          className={WARNING_STRIP_CLASS}
        >
          Save conflict: this record was changed by another user. Reload to see the latest version
          before editing again.
        </div>
      )}
      {props.conflict && props.onDismissConflict && (
        <ConflictToast
          key={props.conflict.token}
          conflict={props.conflict}
          onDismiss={props.onDismissConflict}
        />
      )}
    </>
  )
}
