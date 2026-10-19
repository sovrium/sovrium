/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RefObject } from 'react'

/**
 * Where a floating popup (a menu, a popover, a select's list) is portaled: the
 * open MODAL `<dialog>` when there is one, else the body.
 *
 * A modal dialog — the sidebar drawer opened on a phone, most often — is drawn
 * in the browser's top layer, above everything in the page, and makes the rest
 * of the page inert. A popup portaled to the body is therefore drawn BEHIND it
 * and cannot be pressed: the reader opens the account menu in the drawer's
 * footer and nothing appears. Portaled into the dialog it shares the dialog's
 * top layer, as shadcn/ui's sidebar account menu does.
 *
 * No anchor is needed to find the dialog: while a modal is open nothing outside
 * it can be pressed, so a popup opening at all opens from inside the topmost
 * one — the last in document order.
 *
 * A ref whose `current` is a GETTER, so the dialog is looked up when the portal
 * mounts — each time the popup opens — rather than when the island rendered,
 * which is before the drawer lifted the navigation into its dialog.
 */
export const modalPortalContainer: RefObject<HTMLElement | null> = {
  get current(): HTMLElement | null {
    const modals = document.querySelectorAll<HTMLDialogElement>('dialog:modal')
    return modals[modals.length - 1] ?? null
  },
}
