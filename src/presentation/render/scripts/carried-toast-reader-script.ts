/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { takeCarriedToast } from '@/presentation/design/carried-toast'
import { INLINE_TOAST_POLICY_RUNTIME } from '@/presentation/render/registry/inline-toast-policy-runtime'

/**
 * The reader of a toast carried from the previous page, run on EVERY page.
 *
 * A success that showed a toast and moved to another page keeps the toast in
 * the tab's session storage (`design/carried-toast.ts`); the page it lands on
 * shows it once. That page may ship no client runtime and no command palette
 * at all — a plain thank-you page, an app with `palette: { enabled: false }` —
 * so the reader rides in the body-end enhancer script every page carries
 * (`render/page/page-body-scripts.tsx`), and nowhere else: the first page that
 * loads reads the key and clears it, so the toast shows once.
 *
 * It draws through the shared inline toast policy
 * (`inline-toast-policy-runtime.ts`), the same dismissal, announcement and
 * toaster adoption the palette's toasts follow: a toaster the page renders
 * server-side (`page.toasts`, with its position and localized dismiss label) is
 * adopted, and one is created when the page has none. The message is set as
 * text, never as markup, and `takeCarriedToast` has already dropped a variant
 * or duration no renderer knows — the payload is data any script on this
 * origin could have written.
 *
 * The policy is shipped with its comment lines and indentation removed: it is
 * in the HTML of every page, and those bytes say nothing to a browser. The
 * strip is line-based and safe for that source, whose comments are whole lines
 * and whose strings hold no line break (the module's test executes the result).
 * The bytes still cost every page about 3 KB before compression — the price of
 * a reader that needs no runtime the page did not otherwise ship.
 */

/** `source` without its whole-line `//` comments, indentation and blank lines. */
export function compactInlineScript(source: string): string {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .join('\n')
}

/**
 * The self-contained enhancer: an IIFE that does nothing unless a carried toast
 * waits, and then shows it once the document is parsed.
 */
export const CARRIED_TOAST_READER_SCRIPT = `!function(){var takeCarriedToast=${compactInlineScript(String(takeCarriedToast))};
function raiseCarriedToast(){
${compactInlineScript(INLINE_TOAST_POLICY_RUNTIME)}
var carried=takeCarriedToast();
if(carried)showToast(carried.message,carried.variant,carried.duration);
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",raiseCarriedToast)}else{raiseCarriedToast()}}();`
