/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { someComponentInTree } from '@/presentation/utils/component-template-walker'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

/**
 * The no-FOUC color-scheme head script is emitted when the page declares a
 * `theme-toggle` component OR the app configures `theme.colorScheme`. In
 * either case the runtime needs to apply the stored / configured / system
 * scheme before content renders.
 *
 * Detection walks `children` (a toggle nested inside a container / flex /
 * card is found) AND descends into referenced `app.components` templates so
 * a toggle hosted in a shared site-header template also boots the script.
 */
export function needsColorSchemeScript(
  page: Page,
  theme: Theme | undefined,
  components?: Components
): boolean {
  if (theme?.colorScheme) return true
  return someComponentInTree(
    page.components as readonly unknown[] | undefined,
    components,
    (item) => item['type'] === 'theme-toggle'
  )
}

/**
 * Build the no-FOUC color-scheme bootstrap script body.
 *
 * Runs synchronously in `<head>` ahead of the stylesheet so the `dark` class
 * is on `<html>` before first paint (no flash of the wrong theme). Resolution
 * order: stored `localStorage.theme` override → configured `colorScheme`
 * ('dark'/'light') → system `prefers-color-scheme` ('system' or unset).
 *
 * The body deliberately contains no `<` characters before `classList` so the
 * no-FOUC spec regex (`localStorage … classList`) matches.
 */
export function buildColorSchemeScript(colorScheme: Theme['colorScheme']): string {
  // Configured default when there is no stored override: 'dark' | 'light' |
  // 'system'. Anything else (undefined) falls back to system preference.
  const configured = colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : 'system'
  return `(function(){try{var stored=window.localStorage.getItem('theme');var dark;if(stored==='dark'){dark=true}else if(stored==='light'){dark=false}else{var configured='${configured}';if(configured==='dark'){dark=true}else if(configured==='light'){dark=false}else{dark=window.matchMedia('(prefers-color-scheme: dark)').matches}}var root=document.documentElement;if(dark){root.classList.add('dark')}else{root.classList.remove('dark')}}catch(e){}})();`
}
