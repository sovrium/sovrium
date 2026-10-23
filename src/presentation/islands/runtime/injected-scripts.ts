/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bring the inert scripts of client-injected markup to life.
 *
 * The HTML parser marks a `<script>` inserted through `innerHTML` (or parsed in
 * a `<template>`) as already started, so it never runs. A host that injects
 * server-rendered markup — an overlay body, a tab panel, a page region swapped
 * in by client-side navigation — re-creates each executable script so the
 * browser runs it once. Kept a tier below its hosts so the navigation island
 * reaches it without loading the overlay helpers beside it.
 *
 * SECURITY: the markup is server-rendered from the app's own configuration; a
 * record value reaches it only as escaped text or sanitized rich text, so the
 * only executable scripts are the renderer's own inline runtimes, each of which
 * binds once per element.
 */

/** Script types the browser executes; anything else (JSON config) stays data. */
const isExecutableScript = (script: HTMLScriptElement): boolean => {
  const type = script.type.trim().toLowerCase()
  return type === '' || type === 'text/javascript' || type === 'module'
}

/**
 * Marks a script this module has already brought to life, so a host that scans
 * the same subtree more than once (the tabs island, on every tab switch) runs
 * each injected script once — and only a panel injected AGAIN, whose scripts are
 * fresh copies without the mark, runs its scripts again.
 */
const LIVE_SCRIPT_MARK = 'data-injected-live'

/**
 * Replace each executable script with a fresh copy, which the browser runs on
 * insertion. Attributes are copied so a script can still read its own markers.
 * A script already brought to life here is skipped.
 */
export function runInjectedScripts(root: HTMLElement): void {
  Array.from(root.querySelectorAll('script'))
    .filter((script) => isExecutableScript(script) && !script.hasAttribute(LIVE_SCRIPT_MARK))
    .forEach((inert) => {
      const live = document.createElement('script')
      Array.from(inert.attributes).forEach((attr) => live.setAttribute(attr.name, attr.value))
      live.setAttribute(LIVE_SCRIPT_MARK, '')
      live.textContent = inert.textContent
      inert.replaceWith(live)
    })
}
