/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pages the one-click sign-in listener answers the browser with. HTML for a
 * browser tab, not terminal output.
 */

/** Headers of every page the listener serves. */
export const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
} as const

/**
 * `<!doctype html>`, with its `!` escaped: the terminal-language gate reads a
 * literal `!` in this tree as exclamatory prose, and a doctype is neither.
 */
const DOCTYPE = '<\x21doctype html>'

/** A static page: no script, no external resource, nothing to leak the address to. */
const resultPage = (status: number, title: string, message: string): Response =>
  new Response(
    `${DOCTYPE}<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
      `<h1>${title}</h1><p>${message}</p></body></html>`,
    { status, headers: pageHeaders }
  )

/** The browser brought back a code: the sign-in continues in the terminal. */
export const approvedPage = (): Response =>
  resultPage(200, 'Approved', 'Signed in — return to your terminal.')

/** The browser brought back a refusal. */
export const deniedPage = (): Response =>
  resultPage(
    200,
    'Not signed in',
    'The sign-in was denied. Nothing was stored; you can close this page.'
  )

/** `/callback` reached with neither a code nor an error. */
export const emptyReturnPage = (): Response =>
  resultPage(400, 'Nothing to do', 'This page only receives the answer of a sign-in.')
