/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Drawer } from '@base-ui/react/drawer'
import { useCallback, useState } from 'react'
import {
  DRAWER_BODY_CLASSES,
  DRAWER_CONTENT_CLASSES,
  DRAWER_DESCRIPTION_CLASSES,
  DRAWER_HANDLE_CLASSES,
  DRAWER_HEADER_CLASSES,
  DRAWER_OVERLAY_CLASSES,
  DRAWER_POPUP_CLASSES,
  DRAWER_TITLE_CLASSES,
  DRAWER_VIEWPORT_CLASSES,
} from '@/presentation/design/bottom-drawer-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { useDialogOpenState, useHostControls } from './dialog-open-state'
import { DialogChildren } from './dialog-parts'
import type { CSSProperties, ReactElement } from 'react'

interface BottomDrawerIslandProps {
  readonly title?: string
  readonly description?: string
  readonly childrenHtml?: string
  readonly side?: 'bottom' | 'top'
  readonly snapPoints?: readonly number[]
  readonly handle?: boolean
  readonly modal?: boolean
  readonly swipeToDismiss?: boolean
  readonly className?: string
  readonly id?: string
  readonly hasOpener?: boolean
  readonly 'data-testid'?: string
}

/** The header: the title and the description, omitted when neither is declared. */
const DrawerHeading = ({
  title,
  description,
}: Pick<BottomDrawerIslandProps, 'title' | 'description'>): ReactElement | undefined =>
  title === undefined && description === undefined ? undefined : (
    <div
      data-slot="drawer-header"
      className={DRAWER_HEADER_CLASSES}
    >
      {title === undefined ? undefined : (
        <Drawer.Title
          data-slot="drawer-title"
          className={DRAWER_TITLE_CLASSES}
        >
          {title}
        </Drawer.Title>
      )}
      {description === undefined ? undefined : (
        <Drawer.Description
          data-slot="drawer-description"
          className={DRAWER_DESCRIPTION_CLASSES}
        >
          {description}
        </Drawer.Description>
      )}
    </div>
  )

/** The panel's snap points, and the one it rests at, controlled so its height can follow. */
function useDrawerSnap(snapPoints: readonly number[] | undefined) {
  const points = snapPoints === undefined || snapPoints.length === 0 ? undefined : [...snapPoints]
  const [snap, setSnap] = useState<number | undefined>(points?.[0])
  const onSnapPointChange = useCallback((next: Drawer.Root.SnapPoint | null): void => {
    if (typeof next === 'number') setSnap(next)
  }, [])
  const style =
    snap === undefined
      ? undefined
      : ({ '--drawer-snap-height': `${String(snap * 100)}dvh` } as CSSProperties)
  return {
    points,
    snap: points === undefined ? undefined : (snap ?? points[0]),
    onSnapPointChange,
    style,
  }
}

interface DrawerPanelProps {
  readonly props: BottomDrawerIslandProps
  readonly panelId: string
  readonly snapped: boolean
  readonly style: CSSProperties | undefined
  readonly onCancel: Parameters<typeof DialogChildren>[0]['onCancel']
}

/** The popup: the handle, the header and the injected children. */
function DrawerPanel({ props, panelId, snapped, style, onCancel }: DrawerPanelProps): ReactElement {
  const modal = props.modal !== false
  return (
    <Drawer.Popup
      id={panelId}
      data-testid={props['data-testid']}
      data-slot="drawer-popup"
      aria-modal={modal ? 'true' : undefined}
      data-swipe-axis="y"
      data-snap-points={snapped ? '' : undefined}
      className={resolveClasses(DRAWER_POPUP_CLASSES, props.className)}
      style={style}
    >
      {props.handle === false ? undefined : (
        <div
          data-slot="drawer-handle"
          aria-hidden="true"
          className={DRAWER_HANDLE_CLASSES}
        />
      )}
      <Drawer.Content
        data-slot="drawer-content"
        className={DRAWER_CONTENT_CLASSES}
      >
        <DrawerHeading
          title={props.title}
          description={props.description}
        />
        {props.childrenHtml === undefined || props.childrenHtml === '' ? undefined : (
          <div className={DRAWER_BODY_CLASSES}>
            <DialogChildren
              html={props.childrenHtml}
              onCancel={onCancel}
            />
          </div>
        )}
      </Drawer.Content>
    </Drawer.Popup>
  )
}

/**
 * `drawer` — a panel that rises from the bottom edge (or drops from the top),
 * on Base UI's Drawer: opened by a trigger naming its id, dragged by its handle,
 * resting at its snap points, dismissed by a swipe toward its edge unless
 * `swipeToDismiss` is off. Escape and the overlay still close it.
 */
export default function BottomDrawerIsland(props: BottomDrawerIslandProps): ReactElement {
  const modal = props.modal !== false
  const swipeToDismiss = props.swipeToDismiss !== false
  const { open, setOpen, onOpenChangeComplete, onCancel } = useDialogOpenState(
    props.hasOpener,
    props.id
  )
  const { id: panelId, anchor } = useHostControls(open, props.id)
  const onOpenChange = useCallback(
    (next: boolean, details: Drawer.Root.ChangeEventDetails): void => {
      if (!next && !swipeToDismiss && details.reason === 'swipe') return
      setOpen(next)
    },
    [setOpen, swipeToDismiss]
  )
  const { points, snap, onSnapPointChange, style } = useDrawerSnap(props.snapPoints)
  return (
    <Drawer.Root
      open={open}
      modal={modal}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      swipeDirection={props.side === 'top' ? 'up' : 'down'}
      snapPoints={points}
      snapPoint={snap}
      onSnapPointChange={onSnapPointChange}
    >
      {anchor}
      <Drawer.Portal>
        {modal ? (
          <Drawer.Backdrop
            data-slot="drawer-overlay"
            data-snap-points={points === undefined ? undefined : ''}
            className={DRAWER_OVERLAY_CLASSES}
          />
        ) : undefined}
        <Drawer.Viewport
          data-slot="drawer-viewport"
          data-modal={modal}
          className={DRAWER_VIEWPORT_CLASSES}
        >
          <DrawerPanel
            props={props}
            panelId={panelId}
            snapped={points !== undefined}
            style={style}
            onCancel={onCancel}
          />
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
