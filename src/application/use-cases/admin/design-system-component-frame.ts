/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The document behind one viewport frame — what a `specimen` declaring a
 * `viewport` is re-rendered inside.
 *
 * ─── WHY A DOCUMENT AND NOT A NARROWER BOX ─────────────────────────────────
 *
 * A `@media` query has exactly one input, the viewport, and nothing inside a
 * document can change it. A specimen drawn inline into the console page sits in
 * the console's document, so putting it in a 375px-wide `div` narrows the
 * markup while every breakpoint keeps answering the reader's 1440px window: the
 * component squeezes sideways and overflows instead of collapsing to the layout
 * it actually has at 375. Measured on the console's own Components page, a
 * `site-header` declaring `hidden lg:flex` / `lg:hidden` computed the SAME
 * `flex` / `none` pair in all three of the Desktop, Tablet and Mobile frames.
 *
 * So the only way to render a component AT a width is to give it a document
 * whose viewport IS that width, which is an `<iframe>` of that width.
 *
 * ─── BUILT FROM THE OPERATOR'S APP, FIELD BY FIELD ─────────────────────────
 *
 * Every other `/_admin` path resolves to a surface spread from the EMBEDDED
 * console config, which is what keeps the console wearing Sovrium's chrome. A
 * framed specimen must do the opposite: it exists to show the OPERATOR's
 * component under the OPERATOR's theme, so it is built from their app and
 * carries their name.
 *
 * That one fact routes the stylesheet for free. `isOperatorConsoleApp` is false
 * here, so `getVersionedCssPath` mints the operator's hash and the existing
 * `/assets/:file` route serves the operator's own compiled stylesheet — with
 * their real `@media` breakpoints and `:root` to itself. That IS the mechanism
 * that makes the media queries fire; no second CSS route is involved.
 *
 * The app is assembled FIELD BY FIELD rather than spread. `tables`, `env`,
 * `auth`, `automations` and everything else stay behind, so [internal ref] A2's
 * confidentiality bound holds BY CONSTRUCTION rather than by a redaction pass
 * someone has to remember to extend. This is the same construction the retired
 * `design-system-preview-surface.ts` used, and for the same reason.
 *
 * ─── THE THEME IS COPIED UNTOUCHED, WHICH IS LOAD-BEARING ──────────────────
 *
 * It is tempting to fold a requested `?scheme=dark` into `design.colorScheme`
 * here so the document "describes itself honestly". It must not be done:
 * `getVersionedCssHash` digests `design`, so a mutated one mints a stylesheet
 * identity nothing ever compiled. The scheme is resolved on the client instead,
 * by the head script below — exactly as the console's own pages resolve theirs,
 * and for the same reason they do.
 *
 * ─── THE LINKED HASH IS THE OPERATOR'S CONTENT, NOT THEIR URL ──────────────
 *
 * `getVersionedCssHash` digests `design` AND the class candidates harvested
 * from the app, and this app carries one page where the operator's carries all
 * of theirs — so the minted hash is NOT byte-equal to the one the operator's
 * own pages link. `resolveCssApp` (`route-setup/static-assets.ts`) resolves an
 * unrecognised hash to the operator app, which is the documented and deliberate
 * fallback, so the frame is served the operator's real compiled stylesheet with
 * their real `@media` breakpoints. Every class the framed template uses is in
 * that corpus by construction: the template is one of `components[]`, which the
 * operator's own candidate scan already walks.
 *
 * What the mismatch costs is a short `Cache-Control` instead of an immutable
 * one, on a document only the console ever loads. What matching it would cost
 * is dragging the operator's whole `pages[]` into this builder, which is the
 * one thing the field-by-field construction above exists to avoid.
 *
 * ─── IT IS A FRAME, NOT A SECOND HOST ──────────────────────────────────────
 *
 * There are no user-navigable `/preview/:section` routes: a second
 * user-navigable host for the same content is a second place for the scheme,
 * the rail and the specimen bounds to disagree. This does not become one. What this serves is the INSIDE of a frame: no heading, no rail, no
 * chrome, no navigation, linked from nothing, and embeddable only by its own
 * origin (`frame-ancestors 'self'`, set by the route).
 */

import { COMPONENT_FRAME_BASE } from '@/domain/models/app/admin/mount-hrefs'
import { componentSampleVars } from '@/domain/models/app/pages/component-sample-service'
import { SPECIMEN_RECORD_ID } from '@/domain/models/app/pages/specimen-sample-service'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The mount-relative path one framed document answers on.
 *
 * @param name - the operator template being framed, already URL-decoded.
 */
export const componentFramePath = (name: string): string =>
  `${COMPONENT_FRAME_BASE}/${encodeURIComponent(name)}`

/**
 * The head script that puts the framed document in the console's own scheme.
 *
 * ─── THE ONE AXIS THAT CROSSES THE FRAME BOUNDARY ──────────────────────────
 *
 * Everything else about a frame is deliberately isolated — that is what the
 * document boundary is FOR. The scheme is the exception: a light specimen
 * inside a dark console is an admin design system spec's defect wearing an
 * `<iframe>`, and a reader reviewing a header in the dark cannot review the
 * dark header if the frame stays light.
 *
 * Three inputs, in the order a reader would expect:
 *
 *  1. **This document's own `?scheme=`.** Only ever present when the frame is
 *     addressed directly, which is not how it is reached — but a document that
 *     ignores a scheme it was explicitly asked for is a document that lies
 *     about one input while honouring two.
 *  2. **The host's RESOLVED scheme**, read as `html.dark` across a same-origin
 *     parent. Deliberately the resolved class rather than the parent's query or
 *     its `localStorage`: the console already resolves a deep link, a stored
 *     preference and the system default in its own documented precedence, and
 *     re-deriving that here would be a second implementation of one rule with
 *     two places to drift. Reading the ANSWER cannot diverge from it.
 *  3. **The stored preference**, for a frame with no reachable parent.
 *
 * It runs in `<head>`, ahead of the stylesheet, so the class lands before first
 * paint and there is no flash of the wrong scheme. It writes nothing to
 * storage: a frame is not a preference.
 *
 * TIMING. A parent parses its `<head>` — and therefore runs its own no-FOUC
 * script — before it reaches the `<iframe>` in its `<body>`, so step 2 reads a
 * class that is already settled rather than racing it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: repaint when the operator moves the
 * chrome's scheme toggle while frames are mounted. A `storage` listener is the
 * cheap fix and is a founder call rather than an omission — recorded in the
 * B6c handoff §5.2.
 */
const FRAME_SCHEME_SCRIPT =
  '(function(){try{' +
  "var q=new URLSearchParams(window.location.search).get('scheme');var dark;" +
  "if(q==='dark'){dark=true}else if(q==='light'){dark=false}else{" +
  'var host=null;try{host=window.parent!==window?window.parent.document:null}catch(e){host=null}' +
  "if(host){dark=host.documentElement.classList.contains('dark')}else{" +
  "var s=window.localStorage.getItem('theme');" +
  "if(s==='dark'){dark=true}else if(s==='light'){dark=false}else{" +
  "dark=window.matchMedia('(prefers-color-scheme: dark)').matches}}}" +
  'var root=document.documentElement;' +
  "if(dark){root.classList.add('dark')}else{root.classList.remove('dark')}" +
  '}catch(e){}})();'

/**
 * The body-end script that grows the frame to its content.
 *
 * ─── SIZING BELONGS TO THE DOCUMENT, NOT TO ITS HOST ───────────────────────
 *
 * An `<iframe>` is 150px tall by default and does not grow with its document,
 * so a frame that is merely inserted CLIPS its subject — the review's *"the
 * mobile frame clipped"* arriving by a new route. A clipped specimen shows the
 * top-left corner of a component and calls it the component.
 *
 * The measurement is made HERE rather than in the host page because the
 * document is the only party that knows its own height, and `window.frameElement`
 * is reachable same-origin without a channel, a message protocol, or a line of
 * client bundle. Nothing about this reaches the eager island closure: it is an
 * inline script inside a document only a frame ever loads.
 *
 * It runs at body end, during parsing, so the height is already right when the
 * host's `load` event fires — and it re-fits on a `ResizeObserver` so a webfont
 * settling or an image decoding does not leave a gap under the subject.
 *
 * ─── AND IT SCALES THE FRAME TO ITS COLUMN ─────────────────────────────────
 *
 * A 1280 document in a ~650 px column that keeps its full width and scrolls
 * shows a reader its left half, under a note saying nothing is clipped. When the
 * host wraps the frame in a `data-specimen-scale-box`, the document keeps its
 * declared width (its `@media` rules still answer 1280) and is SCALED to the
 * box with a transform, the box takes the scaled height, and the scale is
 * written to `data-frame-scale` and to the nearest `[data-design-frame-scale]`
 * label of its section, so the page can say "shown at 51 %".
 */
const FRAME_AUTOSIZE_SCRIPT =
  '(function(){try{var f=window.frameElement;if(!f)return;' +
  "var box=f.parentElement&&f.parentElement.hasAttribute('data-specimen-scale-box')?f.parentElement:null;" +
  'var fit=function(){var h=document.documentElement.scrollHeight;var s=1;' +
  'if(box){var w=f.offsetWidth;var room=box.clientWidth;s=room>0&&w>room?room/w:1;' +
  "box.style.height=Math.ceil(h*s)+'px';var pct=String(Math.round(s*100));" +
  "f.setAttribute('data-frame-scale',pct);" +
  "var section=box.closest('[data-design-section]');" +
  "var label=section?section.querySelector('[data-design-frame-scale]'):null;" +
  "if(label){label.textContent=pct+' %'}}" +
  "f.style.transform=s<1?'scale('+s+')':'';f.style.height=h+'px'};fit();" +
  "window.addEventListener('load',fit);" +
  "if(typeof ResizeObserver==='function'){var ro=new ResizeObserver(fit);" +
  'ro.observe(document.documentElement);if(box){ro.observe(box)}}' +
  '}catch(e){}})();'

/**
 * The document's own stylesheet.
 *
 * `margin: 0` because the frame is measured from `scrollHeight` and a body
 * margin is height the subject does not occupy — it would report as clipping on
 * one side and as a gap on the other. `overflow-x: auto` so a subject WIDER
 * than its declared viewport scrolls rather than being cut: at 375 a header
 * that has not collapsed is exactly the finding a reader came for, and hiding
 * the overflow would hide it.
 */
const FRAME_DOCUMENT_STYLES =
  'html,body{margin:0;padding:0}body{overflow-x:auto}' +
  // The frame IS the specimen's bounds, so it paints the app's own page surface
  // rather than floating on whatever the browser defaults to. Emitted as the
  // engine's own utility classes would be, but as a rule, because a frame with
  // no class on its body still has to paint.
  'body{background:var(--color-background,transparent);color:var(--color-foreground,inherit)}'

/**
 * The head script that keeps every form of a specimen inert.
 *
 * A specimen draws its forms — the code field, the invitation's answers, the
 * editor's Save — because that is the state being documented, and a reader may
 * press them. None may send anything: the document is drawn on a SAMPLE, and a
 * submit would carry made-up values to a real endpoint. Every submit is stopped
 * in the capture phase at the document, before any handler on the form sees it,
 * so no request leaves and the frame does not navigate.
 */
const FRAME_INERT_FORMS_SCRIPT =
  "document.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation()},true);"

/** The page one framed document renders, its template drawn on its sample `vars`. */
const framePage = (
  name: string,
  path: string,
  template: Component,
  drawn: {
    readonly vars: Readonly<Record<string, string>>
    readonly context: Partial<Pick<Page, 'dataSource' | 'invitation'>>
  }
): Page =>
  ({
    ...drawn.context,
    id: `design-system-component-frame-${name}`,
    name: `design-system-component-frame-${name}`,
    path,
    meta: {
      // A frame is not a destination, and a search engine that reached one
      // would index a fragment of a console page with no way back.
      title: name,
      lang: 'en-US',
      robots: 'noindex, nofollow',
      customElements: [{ type: 'style', content: FRAME_DOCUMENT_STYLES }],
    },
    scripts: {
      inlineScripts: [
        { code: FRAME_SCHEME_SCRIPT, position: 'head' },
        { code: FRAME_INERT_FORMS_SCRIPT, position: 'head' },
        { code: FRAME_AUTOSIZE_SCRIPT, position: 'body-end' },
      ],
    },
    // The template BY REFERENCE, not written out. The reference is what routes
    // it through `renderComponentReference`, which is the same path an ordinary
    // page of the operator's own takes to draw it — so the frame documents what
    // their pages render rather than a second interpretation of it.
    //
    // With the SAMPLE `vars` (`componentSampleVars`): what the first page
    // embedding the template supplies, so the frame draws a card a reader
    // recognises rather than `$label` / `$value` placeholders.
    components: [
      { component: (template as { readonly name?: string }).name ?? name, vars: drawn.vars },
    ],
  }) as Page

/** One framed document: the app to render, the path to render it at, and its query. */
export interface ComponentFrame {
  readonly app: App
  readonly renderPath: string
  readonly requestQuery: Readonly<Record<string, string>>
}

/** Whether a tree places the template `name` anywhere (`{ component: name }`). */
const places = (node: unknown, name: string): boolean => {
  if (Array.isArray(node)) return node.some((child) => places(child, name))
  if (typeof node !== 'object' || node === null) return false
  if ((node as { readonly component?: unknown }).component === name) return true
  return Object.values(node).some((value) => places(value, name))
}

type PageContext = Partial<Pick<Page, 'dataSource' | 'invitation'>>

/**
 * What the template is about where it is used: the record and the invitation
 * of the FIRST page that places it. A record editor reads `$record`, an
 * invitation card `$invitation`; drawn without the page that gives them one,
 * each drew its empty or failure state. The frame page declares the same
 * binding, and the specimen readers answer it with a sample.
 */
const hostContext = (operatorApp: App, name: string): PageContext => {
  const host = (operatorApp.pages ?? []).find((page) => places(page.components, name))
  const { dataSource, invitation } = (host ?? {}) as PageContext
  return {
    ...(dataSource === undefined ? {} : { dataSource }),
    ...(invitation === undefined ? {} : { invitation }),
  }
}

/** The route parameter a single-record binding reads, when it reads one. */
const recordParamOf = (context: PageContext): string | undefined => {
  const binding = context.dataSource as
    { readonly mode?: string; readonly param?: string } | undefined
  return binding?.mode === 'single' ? binding.param : undefined
}

/** The app one frame renders: the operator's config, field by field, and the frame page. */
const frameAppOf = (operatorApp: App, page: Page): App =>
  ({
    // The OPERATOR's name, which is what keeps `isOperatorConsoleApp` false and
    // routes this document to the operator's stylesheet rather than to the
    // console's. Not cosmetic.
    name: operatorApp.name,
    ...(operatorApp.displayName === undefined ? {} : { displayName: operatorApp.displayName }),
    // The whole design key, copied UNTOUCHED — see the module docblock on why
    // folding a requested scheme in here would link a stylesheet that was never
    // compiled.
    ...(operatorApp.design === undefined ? {} : { design: operatorApp.design }),
    // The operator's own reusable templates, so the reference resolves. CONFIG,
    // not data: a template is a composition the author wrote, in the same class
    // as `design.theme`.
    components: operatorApp.components,
    // The table DEFINITIONS and the auth block, so a form draws its fields and
    // an auth form its controls. Config again, and no rows: the frame renders
    // with sample readers only (`specimen`), which answer every read with a
    // sample synthesised from these very definitions, so A2's bound holds by
    // construction — there is no reader in the frame that returns a row.
    ...(operatorApp.tables === undefined ? {} : { tables: operatorApp.tables }),
    ...(operatorApp.auth === undefined ? {} : { auth: operatorApp.auth }),
    // The operator's TRANSLATION table, for one narrowly-scoped reason: a
    // reusable component may carry `$t:` lookups, and a document built without
    // `languages` resolves none of them — a framed header would draw
    // `nav.docs.zone.runtime` as literal body text. Also config, also no
    // records and no secrets.
    ...(operatorApp.languages === undefined ? {} : { languages: operatorApp.languages }),
    // Sovrium's own documentation surface, not a generated app page: no "Built
    // with Sovrium" badge, and no auto-appended record palette — which would
    // mount a search island inside a document that has no records.
    badge: false,
    palette: { enabled: false },
    pages: [page],
  }) as App

/**
 * Build the document that renders one component's frame.
 *
 * @param operatorApp - the live operator app: the source of the theme the frame
 *   paints with AND of the template it draws.
 * @param name - the template named by the `specimen`'s `subject.component`.
 * @param path - the mount-stripped path this document answers on.
 * @returns the frame to render, or `undefined` when this app declares no
 *   template of that name — which the route answers with the same 404 the
 *   component page itself answers for an undeclared name.
 */
export const buildComponentFrame = (
  operatorApp: App,
  name: string,
  path: string
): ComponentFrame | undefined => {
  const template = (operatorApp.components ?? []).find(
    (candidate) => (candidate as { readonly name?: unknown }).name === name
  )
  if (template === undefined) return undefined
  const context = hostContext(operatorApp, name)
  const param = recordParamOf(context)
  // A page bound to one record names it in its address; the frame's address
  // names the sample record the specimen readers answer for.
  const pagePath = param === undefined ? path : `${path}/:${param}`
  const invitationParam = (context.invitation as { readonly param?: string } | undefined)?.param

  const app = frameAppOf(
    operatorApp,
    framePage(name, pagePath, template as Component, {
      vars: componentSampleVars(operatorApp, name),
      context,
    })
  )

  return {
    app,
    renderPath: param === undefined ? path : `${path}/${SPECIMEN_RECORD_ID}`,
    // An invitation page reads its token from the address: the sample one.
    requestQuery:
      context.invitation === undefined ? {} : { [invitationParam ?? 'token']: 'specimen' },
  }
}
