/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `destructive` sidebar count does to the collapsible group holding it.
 *
 * The server decides a collapsible group's open state from what it can see —
 * the current entry. A count of failures arrives later, from the client, so the
 * two rules that read it are applied here when it lands:
 *
 *  - a group holding a non-zero destructive count OPENS, so a failure is never
 *    folded away on arrival;
 *  - the group's label repeats the total while the group is shut, and only
 *    then, so a reader who folds it away still sees that something went wrong.
 *
 * The attribute names are spelled on both sides of the SSR boundary because the
 * render tree and the island tree may not import each other. The open state is
 * written the way the `collapsible` enhancement island reads it —
 * `aria-expanded` on the trigger, `data-state` on the root — so a press after
 * this ran toggles from the state the reader sees.
 */

const COUNT_ATTRIBUTE = 'data-sidebar-badge-count'

const countOf = (host: Element): number => Number(host.getAttribute(COUNT_ATTRIBUTE) ?? '0') || 0

/**
 * Write the label's mirror for the group's current state: the total while
 * shut, nothing while open. Emptied rather than styled away, so an open
 * group's label reads as its label alone, to a script as to a reader.
 */
const syncMirror = (group: HTMLElement, mirror: HTMLElement): void => {
  mirror.replaceChildren(group.dataset['state'] === 'open' ? '' : (mirror.dataset['total'] ?? ''))
}

/** Keep the mirror in step with the group's state, which the `collapsible` island toggles. */
const watchGroup = (group: HTMLElement, mirror: HTMLElement): void => {
  if (mirror.hasAttribute('data-watched')) return
  mirror.setAttribute('data-watched', '')
  new MutationObserver(() => syncMirror(group, mirror)).observe(group, {
    attributes: true,
    attributeFilter: ['data-state'],
  })
}

/**
 * Record one destructive count on its host, and apply what it means to the
 * group around it, if any.
 *
 * @param host - the badge's server-rendered host element.
 * @param count - the count read from the endpoint.
 */
export const applyDestructiveCount = (host: Element, count: number): void => {
  host.setAttribute(COUNT_ATTRIBUTE, String(count))
  const group = host.closest<HTMLElement>('[data-sidebar-collapsible]')
  if (group === null) return
  const total = Array.from(
    group.querySelectorAll(`[data-sidebar-badge-variant="destructive"][${COUNT_ATTRIBUTE}]`)
  ).reduce((sum, one) => sum + countOf(one), 0)
  const mirror = group.querySelector<HTMLElement>('[data-sidebar-group-count]')
  if (total > 0 && group.dataset['state'] !== 'open') {
    const trigger = group.querySelector<HTMLElement>('[data-slot="collapsible-trigger"]')
    trigger?.setAttribute('aria-expanded', 'true')
    group.dataset['state'] = 'open'
  }
  if (mirror === null) return
  mirror.dataset['total'] = total > 0 ? String(total) : ''
  mirror.hidden = total === 0
  syncMirror(group, mirror)
  watchGroup(group, mirror)
}
