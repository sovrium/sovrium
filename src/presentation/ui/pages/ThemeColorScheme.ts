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

export function buildColorSchemeScript(colorScheme: Theme['colorScheme']): string {
  const configured = colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : 'system'
  return `(function(){try{var stored=window.localStorage.getItem('theme');var dark;if(stored==='dark'){dark=true}else if(stored==='light'){dark=false}else{var configured='${configured}';if(configured==='dark'){dark=true}else if(configured==='light'){dark=false}else{dark=window.matchMedia('(prefers-color-scheme: dark)').matches}}var root=document.documentElement;if(dark){root.classList.add('dark')}else{root.classList.remove('dark')}}catch(e){}})();`
}
