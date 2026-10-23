/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasCommandPaletteHost } from './command-palette-capture'
import { hasIslandComponents } from './page-island-detection'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { ReactElement } from 'react'

/**
 * Recovery for the island entry itself, inline because it must already run
 * when the entry fails: the stale-chunk reload lives INSIDE the entry
 * (`islands/runtime/stale-chunk-reload.ts`), so it cannot help then.
 *
 * A module script's `error` does not bubble, so one capturing listener on the
 * window watches for the entry's, which carries `data-island-entry-script`.
 * The first failure is retried at once under a new address (the browser keeps a failed module fetch for the life of the
 * document, so the same address would fail again). A second failure reloads
 * the page, once per tab: the guard sits in `sessionStorage`, as the
 * stale-chunk reload's does, and unreadable storage counts as "already
 * reloaded". Past that, a short notice tells the reader the page could not
 * finish loading; the server-rendered content stays readable under it. A
 * normal load pays one listener and nothing else.
 */
const ISLAND_ENTRY_RECOVERY_SCRIPT = `(function(){var n=0,k="sovrium:entry-reload";addEventListener("error",function(e){var t=e.target;if(!t||t.tagName!=="SCRIPT"||!t.hasAttribute("data-island-entry-script"))return;if(n++===0){var r=document.createElement("script");r.type="module";r.src=t.getAttribute("src")+"?retry=1";r.setAttribute("data-island-entry-script","");document.body.appendChild(r);return}try{if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");location.reload();return}}catch(x){}var a=document.createElement("div");a.setAttribute("role","alert");a.textContent="This page could not finish loading. Check your connection, then reload it.";a.style.cssText="position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:2147483647;padding:.75rem 1rem;border-radius:.5rem;background:#18181b;color:#fafafa;font:14px/1.4 system-ui,sans-serif";document.body.appendChild(a)},true)})()`

/**
 * The island runtime's entry, in one of two forms.
 *
 * A page with islands loads it: one module script at the end of `<body>`.
 *
 * A page whose only island is the built-in ⌘K palette does NOT load it. That
 * palette is on nearly every page and is opened on a few of them, so loading
 * the island runtime for it would put the whole client closure on every page a
 * reader merely looks at. The page carries an inert `<template>` naming the
 * entry instead, and the head capture script loads it on the first open
 * (`COMMAND_PALETTE_CAPTURE_SCRIPT`). A template fetches nothing and renders
 * nothing.
 */
export function IslandEntryScript({
  page,
  components,
  islandEntryFile,
}: {
  readonly page: Page
  readonly components?: Components
  readonly islandEntryFile?: string
}): ReactElement | undefined {
  if (islandEntryFile === undefined) return undefined
  const src = `/assets/islands/${islandEntryFile}`
  if (hasIslandComponents(page, components)) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: ISLAND_ENTRY_RECOVERY_SCRIPT }} />
        <script
          src={src}
          type="module"
          data-island-entry-script=""
        />
      </>
    )
  }
  if (!hasCommandPaletteHost(page.components)) return undefined
  return <template data-island-entry={src} />
}
