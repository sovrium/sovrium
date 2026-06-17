/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

function getChildren(component: { readonly children?: unknown }): readonly unknown[] | undefined {
  const { children } = component
  return Array.isArray(children) ? children : undefined
}

function treeHasThemeToggle(components: readonly unknown[] | undefined): boolean {
  if (!components) return false
  return components.some((item) => {
    if (typeof item !== 'object' || item === null) return false
    const component = item as { readonly type?: unknown; readonly children?: unknown }
    if (component.type === 'theme-toggle') return true
    return treeHasThemeToggle(getChildren(component))
  })
}

export function needsColorSchemeScript(page: Page, theme: Theme | undefined): boolean {
  if (theme?.colorScheme) return true
  return treeHasThemeToggle(page.components as readonly unknown[] | undefined)
}

export function buildColorSchemeScript(colorScheme: Theme['colorScheme']): string {
  const configured = colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : 'system'
  return `(function(){try{var stored=window.localStorage.getItem('theme');var dark;if(stored==='dark'){dark=true}else if(stored==='light'){dark=false}else{var configured='${configured}';if(configured==='dark'){dark=true}else if(configured==='light'){dark=false}else{dark=window.matchMedia('(prefers-color-scheme: dark)').matches}}var root=document.documentElement;if(dark){root.classList.add('dark')}else{root.classList.remove('dark')}}catch(e){}})();`
}
