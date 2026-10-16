/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * A mounted console grid, read by a caller who may not make the console's
 * operational writes, offers no write at all: no "New record", no Import, no
 * trailing "New row", no inline edit, no Delete on a selection.
 *
 * A mounted page renders SESSION-LESS, so the table's own write gates — which
 * read a session — cannot decide this there, and an absent gate OFFERS create.
 * The mount does know the caller's POWERS (`granted`), and the console's write
 * tier is `edit-operations`. So the two gates are stamped closed here, the way
 * a session would have closed them: ABSENT controls, not disabled ones — a
 * disabled control still tells a read-only operator there is something here
 * they could do. The data stays readable; only the affordances go.
 *
 * Not a mount (`granted` absent): the node is returned untouched, and the
 * ordinary session-derived gates decide.
 */
export function gateMountedWrites(
  node: object,
  granted: ReadonlySet<CallerCapability> | undefined
): object {
  if (granted === undefined || granted.has('edit-operations')) return node
  const component = node as { readonly type?: unknown; readonly props?: Record<string, unknown> }
  if (component.type !== 'table') return node
  return {
    ...component,
    props: { ...component.props, _canCreate: false, _canUpdate: false, _canDelete: false },
  }
}

/**
 * Prune a sidebar's `footer` — the account block — with the same rule as its
 * `children`: it is rendered server-side like them, so a gated node in it (a
 * role badge) is withheld the same way rather than shipped to every reader.
 */
export function pruneFooterSlot(
  node: unknown,
  prune: (nodes: readonly unknown[]) => readonly unknown[]
): unknown {
  const { footer } = node as { readonly footer?: unknown }
  if (!Array.isArray(footer) || footer.length === 0) return node
  return { ...(node as Record<string, unknown>), footer: prune(footer) }
}
