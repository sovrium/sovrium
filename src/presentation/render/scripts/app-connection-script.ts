/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * The app connection every page of an app declaring `auth.presence` opens for
 * a signed-in reader: one WebSocket to `/api/realtime/connection`, held while
 * the page is open. Its being open is what makes her online; its closing, with
 * her last page, is what dates her `lastSeen`.
 *
 * Hand-minified and inlined, like the analytics beacon: it must run on a page
 * that loads no other script. It reconnects after a dropped connection, a few
 * times, further apart each time. A visitor without an account is never sent
 * it, so nothing on her page names presence.
 *
 * On a page whose conversation follows a record for who is typing in it (a
 * `message-scroller` drawn with `data-follow-table` / `data-follow-record`),
 * the same connection follows that record: a `sovrium:typing` event a composer
 * raises is sent on it, and each `typing` frame it receives is raised as a
 * `sovrium:typing-frame` event for the frame to draw — and kept, by person, on
 * `window.sovriumTyping`, so a frame drawn after it arrived still shows it.
 * One socket per page.
 */
const APP_CONNECTION_SCRIPT = `(function(){var n=0,s=null,d=document,t=window.sovriumTyping={},f=d.querySelector("[data-follow-table][data-follow-record]");function u(){var q=f?"?table="+encodeURIComponent(f.getAttribute("data-follow-table"))+"&record="+encodeURIComponent(f.getAttribute("data-follow-record"))+"&page="+encodeURIComponent(location.pathname):"";return(location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/realtime/connection"+q}function o(){s=new WebSocket(u());s.onopen=function(){n=0};s.onmessage=function(e){try{var m=JSON.parse(e.data);if(m&&m.type==="typing"){t[m.userId]={frame:m,at:Date.now()};d.dispatchEvent(new CustomEvent("sovrium:typing-frame",{detail:m}))}}catch(x){}};s.onclose=function(e){if(e.code!==1008&&n<5){n++;setTimeout(o,2000*n)}}}if(f)d.addEventListener("sovrium:typing",function(e){if(s&&s.readyState===1)s.send(JSON.stringify({type:"typing",typing:!!(e.detail&&e.detail.typing)}))});o()})();`

/** Whether a page served to this reader opens the app connection. */
export const opensAppConnection = (
  app: Pick<App, 'auth'>,
  session: SessionInfo | undefined
): boolean =>
  app.auth?.presence !== undefined && session !== undefined && !isGuestSession(session.userId)

/**
 * A rendered page with the app connection appended to its body, for a reader
 * {@link opensAppConnection} admits; every other page is returned unchanged.
 */
export const withAppConnectionScript = (
  html: string,
  context: { readonly app: Pick<App, 'auth'>; readonly session: SessionInfo | undefined }
): string => {
  if (!opensAppConnection(context.app, context.session)) return html
  const at = html.lastIndexOf('</body>')
  const tag = `<script>${APP_CONNECTION_SCRIPT}</script>`
  return at === -1 ? `${html}${tag}` : `${html.slice(0, at)}${tag}${html.slice(at)}`
}
