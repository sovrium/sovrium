/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { KeyboardCode } from '@dnd-kit/core'
import type {
  Activators,
  KeyboardCoordinateGetter,
  SensorInstance,
  SensorProps,
} from '@dnd-kit/core'

/** `@dnd-kit/core` does not re-export its `Coordinates` type from the barrel. */
interface Coordinates {
  readonly x: number
  readonly y: number
}

export interface KanbanKeyboardSensorOptions {
  readonly coordinateGetter?: KeyboardCoordinateGetter
}

const START_CODES: ReadonlySet<string> = new Set([KeyboardCode.Space, KeyboardCode.Enter])
const END_CODES: ReadonlySet<string> = new Set([
  KeyboardCode.Space,
  KeyboardCode.Enter,
  KeyboardCode.Tab,
])
const CANCEL_CODES: ReadonlySet<string> = new Set([KeyboardCode.Esc])
const ORIGIN: Coordinates = { x: 0, y: 0 }

/**
 * The board's keyboard drag sensor — dnd-kit's `KeyboardSensor`, minus the
 * deferred listener attachment that loses the FIRST arrow key.
 *
 * ─── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 *
 * Upstream's `attach()` reads:
 *
 * ```js
 * setTimeout(() => this.listeners.add(EventName.Keydown, this.handleKeyDown))
 * ```
 *
 * The defer is there for a real reason — the activating `Space` is still
 * bubbling toward the document when the sensor is constructed, so a listener
 * added synchronously would see that very keystroke and immediately end the
 * drag it just started. The cost is a window, one macrotask wide, in which the
 * sensor is deaf: any key pressed inside it is dropped on the floor.
 *
 * MEASURED, 10 identical runs of the SC 2.5.7 sequence (focus, `Space`,
 * `ArrowDown`, `Space`) against a two-axis board: **4 of 10** wrote the lane
 * field. Every run started a drag and ended one — the instrumentation shows a
 * `dragStart` and a `dragEnd` each time — but in 6 of them `over` at drag end
 * was still the cell the card started in, because the `ArrowDown` between them
 * had been swallowed. That is not a slow machine or a flaky assertion; it is a
 * keyboard alternative that works about half the time, which for the reader who
 * depends on it is worse than one that never works, because they cannot tell
 * the difference between "the board refused" and "the board did not hear me".
 *
 * ─── HOW THIS ONE AVOIDS THE SAME TRAP WITHOUT THE DEFER ──────────────────
 *
 * By identity. The activating event object is captured at construction and the
 * handler ignores exactly that object, so the listener can go on the document
 * synchronously and the bubbling `Space` passes through harmlessly. Every
 * SUBSEQUENT key — including one dispatched in the same millisecond — is heard.
 *
 * The OTHER half of the keyboard race — a drop that outruns dnd-kit's own
 * resolution of where it landed — is not fixed here. It is not specific to the
 * keyboard (a pointer `dragTo` hits it too), so it is fixed once, on the drop
 * path, in `settled-drop-target.tsx`.
 *
 * ─── AND WHAT IT DELIBERATELY DROPS ───────────────────────────────────────
 *
 * Upstream's scroll handling, which is the other half of `handleKeyDown`: when
 * a scrollable ancestor can move in the key's direction it scrolls *instead* of
 * moving the card, and does so with `behavior: 'smooth'`, betting that the
 * scroll's own drift will re-resolve the drop target hundreds of milliseconds
 * later. A kanban board's cells are its drop targets and they do not move when
 * the page scrolls, so that branch buys nothing here and costs the same race
 * again. An arrow key on this board always moves the card.
 */
export class KanbanKeyboardSensor implements SensorInstance {
  /** dnd-kit's own auto-scroller is pointer-driven; a keyboard drag opts out. */
  public autoScrollEnabled = false

  private readonly props: SensorProps<KanbanKeyboardSensorOptions>
  private readonly documentRef: Document
  /** The keystroke that STARTED the drag — the one event the handler ignores. */
  private readonly activatingEvent: Event
  private referenceCoordinates: Coordinates | undefined = undefined

  public constructor(props: SensorProps<KanbanKeyboardSensorOptions>) {
    this.props = props
    this.activatingEvent = props.event
    const { target } = props.event
    this.documentRef =
      target instanceof Node ? (target.ownerDocument ?? globalThis.document) : globalThis.document

    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleCancel = this.handleCancel.bind(this)

    this.documentRef.addEventListener('keydown', this.handleKeyDown)
    this.documentRef.defaultView?.addEventListener('resize', this.handleCancel)
    this.documentRef.defaultView?.addEventListener('visibilitychange', this.handleCancel)

    props.onStart(ORIGIN)
  }

  private detach(): void {
    this.documentRef.removeEventListener('keydown', this.handleKeyDown)
    this.documentRef.defaultView?.removeEventListener('resize', this.handleCancel)
    this.documentRef.defaultView?.removeEventListener('visibilitychange', this.handleCancel)
  }

  private handleCancel(): void {
    this.detach()
    this.props.onCancel()
  }

  private handleKeyDown(event: Event): void {
    // The activating keystroke, still on its way up to the document. Ignoring it
    // by IDENTITY is what lets the listener be attached synchronously — see the
    // class docstring for the half-working keyboard alternative that buys.
    if (event === this.activatingEvent || !(event instanceof KeyboardEvent)) return

    if (END_CODES.has(event.code)) {
      event.preventDefault()
      this.detach()
      this.props.onEnd()
      return
    }
    if (CANCEL_CODES.has(event.code)) {
      event.preventDefault()
      this.handleCancel()
      return
    }

    const { collisionRect } = this.props.context.current
    const currentCoordinates = collisionRect
      ? { x: collisionRect.left, y: collisionRect.top }
      : ORIGIN
    this.referenceCoordinates = this.referenceCoordinates ?? currentCoordinates

    const { coordinateGetter } = this.props.options
    const next = coordinateGetter?.(event, {
      active: this.props.active,
      context: this.props.context.current,
      currentCoordinates,
    })
    if (!next) return

    event.preventDefault()
    const reference = this.referenceCoordinates
    this.props.onMove({ x: next.x - reference.x, y: next.y - reference.y })
  }

  /**
   * `Space` / `Enter` on the card itself starts the drag — the same activation
   * contract dnd-kit's own keyboard sensor publishes, so a card is picked up
   * with the key a reader would already try.
   */
  public static activators: Activators<KanbanKeyboardSensorOptions> = [
    {
      eventName: 'onKeyDown',
      handler: (event: React.KeyboardEvent, _options, { active }): boolean => {
        if (!START_CODES.has(event.nativeEvent.code)) return false
        const activator = active.activatorNode.current
        if (activator && event.target !== activator) return false
        event.preventDefault()
        return true
      },
    },
  ]
}
