/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { SovriumBadge } from '@/presentation/ui/badge/sovrium-badge'
import { ErrorPage } from '@/presentation/ui/pages/ErrorPage'
import { NotFoundPage } from '@/presentation/ui/pages/NotFoundPage'
import { renderPageByPath } from './render-page'
import type { App } from '@/domain/models/app'

function buildAnalyticsScriptTag(app: App): string | undefined {
  const { analytics } = app
  if (!analytics) return undefined

  const appName = app.name || 'app'
  const sessionTimeout = typeof analytics === 'object' ? (analytics.sessionTimeout ?? 30) : 30
  const script = `(function(){
"use strict";
var E="/api/analytics/collect",A="${appName}",D=true,sessionTimeout=${sessionTimeout};
if(D&&navigator.doNotTrack==="1")return;
var u=function(){
try{var s=new URLSearchParams(location.search);
var d={p:location.pathname,t:document.title,r:document.referrer||void 0,
sw:screen.width,sh:screen.height,
us:s.get("utm_source")||void 0,um:s.get("utm_medium")||void 0,
uc:s.get("utm_campaign")||void 0,ux:s.get("utm_content")||void 0,
ut:s.get("utm_term")||void 0};
var b=JSON.stringify(d);
if(navigator.sendBeacon){navigator.sendBeacon(E,new Blob([b],{type:"application/json"}))}
else{var x=new XMLHttpRequest();x.open("POST",E,true);x.setRequestHeader("Content-Type","application/json");x.send(b)}
}catch(e){}};
u();
var op=history.pushState;
history.pushState=function(){op.apply(this,arguments);u()};
window.addEventListener("popstate",u);
})()`
  return `<script>${script}</script>`
}

function injectBadgeIntoErrorPage(
  docHtml: string,
  app: App | undefined,
  detectedLanguage: string | undefined
): string {
  if (app === undefined || !isBadgeEnabled(app.badge)) return docHtml
  const badgeHtml = renderToString(<SovriumBadge lang={detectedLanguage} />)
  return docHtml.includes('</body>')
    ? docHtml.replace('</body>', `${badgeHtml}</body>`)
    : `${docHtml}${badgeHtml}`
}

export async function renderNotFoundPage(app?: App, detectedLanguage?: string): Promise<string> {
  if (app) {
    const custom404 = await renderPageByPath(app, '/404', { detectedLanguage })
    if (typeof custom404 === 'string') {
      return custom404
    }
  }

  const html = renderToString(<NotFoundPage />)
  const docHtml = injectBadgeIntoErrorPage(`<!DOCTYPE html>\n${html}`, app, detectedLanguage)
  if (app) {
    const scriptTag = buildAnalyticsScriptTag(app)
    if (scriptTag) {
      return docHtml.includes('</head>')
        ? docHtml.replace('</head>', `${scriptTag}</head>`)
        : `${docHtml}${scriptTag}`
    }
  }
  return docHtml
}

export async function renderErrorPage(app?: App, detectedLanguage?: string): Promise<string> {
  if (app) {
    const custom500 = await renderPageByPath(app, '/500', { detectedLanguage })
    if (typeof custom500 === 'string') {
      return custom500
    }
  }

  const html = renderToString(<ErrorPage />)
  return injectBadgeIntoErrorPage(`<!DOCTYPE html>\n${html}`, app, detectedLanguage)
}
