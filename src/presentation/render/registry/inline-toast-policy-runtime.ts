/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The dismissal policy, TRANSCRIBED for the server-authored inline runtimes.
 *
 * Four renderers raise a `[data-sonner-toaster]` toast. Two of them are island
 * modules and resolve the policy by importing it: `islands/runtime/toast.ts`
 * and `client.ts#showToast` both call `resolveToastDuration`
 * (`islands/runtime/toast-duration.ts`) and the three DOM helpers in
 * `islands/runtime/toast-accessibility.ts`.
 *
 * The other two cannot. `render/registry/command-palette-runtime.ts` and
 * `render/registry/reorderable-list-component.tsx` are constant JavaScript
 * STRINGS dropped into an inline `<script>`, precisely so that a command
 * palette or a three-row list costs no client chunk at all. A string has no
 * import graph: there is no spelling of `import { resolveToastDuration }` that
 * would resolve inside one. So the policy is transcribed here — once, for both
 * — rather than twice, inline, where it would drift apart at the first edit.
 *
 * ─── WHAT A TRANSCRIPTION OWES ────────────────────────────────────────────
 *
 * A copy of a rule is a rule that can silently stop being a copy. The debt is
 * paid by `inline-toast-policy-runtime.test.ts`, which does not grep this
 * string: it EXECUTES `resolveToastDismissal` out of it with `new Function` and
 * compares the result against the real `resolveToastDuration` across every
 * (duration, variant) pair that matters. A drift fails a test rather than a
 * reader.
 *
 * ─── THE POLICY, in the precedence order `toast-duration.ts` states ────────
 *
 *  1. An explicit positive `duration` wins outright, over the variant clause
 *     below — otherwise "an authored duration is honoured" would be false in
 *     exactly the place an author took the trouble to write one.
 *  2. Otherwise an `error` / `destructive` toast persists. A failure the
 *     operator never read is a failure that did not happen.
 *  3. Otherwise it expires after the documented 5000 ms.
 *
 * The third clause of the island policy — "a toast carrying an action button
 * persists" — is deliberately absent rather than forgotten. Neither inline
 * runtime can render an action button: the palette's dark-mode toast takes no
 * arguments beyond its message, and `onReorder` is a `ToastActionSchema`, which
 * has no action slot. Transcribing a branch nothing can reach would make the
 * behavioural test assert over an input neither caller can produce.
 *
 * And the announcement half, from `toast-accessibility.ts`:
 *
 *  4. A toast that never expires carries a `<button data-toast-dismiss>` that
 *     removes ONLY itself, plus an `Escape` route to the most recent one.
 *  5. An `error` / `destructive` toast is announced assertively, via
 *     `role="alert"` and nothing else — pairing it with `aria-live` makes some
 *     assistive technology announce twice.
 *
 * Two variant lists, not one, for the reason `toast-accessibility.ts` gives:
 * timing and announcement are separate concerns that happen to agree today. A
 * toast carrying an action already persists without being urgent.
 *
 * ─── THE TWO THINGS THAT MUST MATCH THE ISLAND SPELLING EXACTLY ────────────
 *
 *  - `data-toast-escape-bound` on `<body>`. A page can carry three copies of
 *    this fragment (one palette plus one per reorderable list) AND the island
 *    bundles, each a separate closure. A module-level boolean would let each
 *    install its own `keydown` handler, and `Escape` would clear as many
 *    toasts as there are copies — silently taking an unread failure with the
 *    read one. The DOM attribute is the only state they share.
 *  - `data-dismiss-label` on the container. The label is served by
 *    `PageToastContainer` and is localized; hard-coding English would announce
 *    the wrong word to the operator it matters most to. `'Dismiss'` is the
 *    fallback for a container this fragment built itself, which had nowhere to
 *    read one from.
 *
 * ─── HOW TO USE IT ────────────────────────────────────────────────────────
 *
 * Splice it into the body of an inline runtime IIFE, the way
 * `COMMAND_PALETTE_RUNTIME_ACTIONS` is spliced: the function declarations
 * hoist into the surrounding closure, so a caller writes `showToast(message)`
 * or `showToast(message, variant, duration)` and nothing else.
 */

/**
 * The documented auto-dismiss delay, in milliseconds, when none is declared.
 *
 * Transcribed rather than imported, and the import is not an oversight:
 * `DEFAULT_TOAST_DURATION_MS` lives in `islands/runtime/toast-duration.ts`, and
 * `render/` may not reach `islands/` — `[internal ref]` grants
 * that edge only to two named files, by explicit path. A transcription pinned
 * by a test is the sanctioned shape here; widening the boundary so one number
 * can be shared is not.
 */
export const INLINE_TOAST_DEFAULT_DURATION_MS = 5000

/**
 * Variants that wait to be dismissed instead of expiring.
 *
 * The transcription of `PERSISTENT_VARIANTS` in `toast-duration.ts`, pinned
 * behaviourally by this module's test rather than by this comment.
 */
export const INLINE_TOAST_PERSISTENT_VARIANTS: readonly string[] = ['error', 'destructive']

/**
 * Variants announced assertively, interrupting whatever is being read.
 *
 * The transcription of `ASSERTIVE_VARIANTS` in `toast-accessibility.ts`. Kept
 * separate from {@link INLINE_TOAST_PERSISTENT_VARIANTS} even though the two
 * hold the same names today, because they answer different questions.
 */
export const INLINE_TOAST_ASSERTIVE_VARIANTS: readonly string[] = ['error', 'destructive']

/** The English fallback for the dismiss control's accessible name. */
export const INLINE_TOAST_DISMISS_LABEL_FALLBACK = 'Dismiss'

/**
 * The shared toast fragment: `showToast(message, variant, duration)` plus the
 * helpers it hoists.
 *
 * `resolveToastDismissal` returns a positive millisecond delay, or `null` for
 * "persist — arm no timer at all". `null` rather than `0`, for the reason
 * `resolveToastDuration` returns `undefined`: so a caller cannot hand the
 * result to `setTimeout` and dismiss instantly.
 */
export const INLINE_TOAST_POLICY_RUNTIME = `
  var TOAST_DEFAULT_DURATION_MS = ${INLINE_TOAST_DEFAULT_DURATION_MS};
  var TOAST_PERSISTENT_VARIANTS = ${JSON.stringify(INLINE_TOAST_PERSISTENT_VARIANTS)};
  var TOAST_ASSERTIVE_VARIANTS = ${JSON.stringify(INLINE_TOAST_ASSERTIVE_VARIANTS)};
  var TOAST_DISMISS_LABEL_FALLBACK = ${JSON.stringify(INLINE_TOAST_DISMISS_LABEL_FALLBACK)};

  // An explicit positive duration wins; otherwise a failure persists;
  // otherwise the documented default. Returns null for "arm no timer".
  function resolveToastDismissal(duration, variant) {
    if (typeof duration === 'number' && duration > 0) return duration;
    if (variant && TOAST_PERSISTENT_VARIANTS.indexOf(variant) !== -1) return null;
    return TOAST_DEFAULT_DURATION_MS;
  }

  // Adopt the server-rendered container when the page declared page.toasts,
  // so a configured position (and the localized dismiss label) survives.
  function ensureToastContainer() {
    var existing = document.querySelector('[data-sonner-toaster]');
    if (existing) return existing;
    var container = document.createElement('div');
    container.setAttribute('data-sonner-toaster', '');
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.style.position = 'fixed';
    container.style.bottom = '16px';
    container.style.right = '16px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
    return container;
  }

  // At most once per document, whichever bundle or inline copy gets there
  // first — the flag is an attribute on <body> and NOT a local, because a page
  // carries several independent copies of this closure.
  function installToastEscapeDismiss() {
    if (document.body.hasAttribute('data-toast-escape-bound')) return;
    document.body.setAttribute('data-toast-escape-bound', 'true');
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      // "Most recent" is DOM order, which is insertion order. A toast with no
      // control is on a timer, and expiring it early is not what Escape was
      // pressed for.
      var toasts = document.querySelectorAll('[data-toast]');
      var target = null;
      for (var i = 0; i < toasts.length; i++) {
        if (toasts[i].querySelector('[data-toast-dismiss]')) target = toasts[i];
      }
      if (target) target.remove();
    });
  }

  function appendToastDismissControl(toast, container) {
    var declared = container.getAttribute('data-dismiss-label');
    var label = declared && declared.trim() !== '' ? declared : TOAST_DISMISS_LABEL_FALLBACK;
    var button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('data-toast-dismiss', '');
    button.setAttribute('aria-label', label);
    button.textContent = '\\u00d7';
    button.addEventListener('click', function () { toast.remove(); });
    toast.appendChild(button);
    installToastEscapeDismiss();
  }

  function showToast(message, variant, duration) {
    if (!message) return;
    var container = ensureToastContainer();
    var toast = document.createElement('div');
    toast.setAttribute('data-toast', '');
    if (variant) toast.setAttribute('data-variant', variant);
    // role="alert" and nothing else: its implicit aria-live is already
    // assertive, and pairing the two makes some readers announce twice. Set
    // BEFORE the single insertion, because role="alert" announces on insert.
    if (variant && TOAST_ASSERTIVE_VARIANTS.indexOf(variant) !== -1) {
      toast.setAttribute('role', 'alert');
    }
    // The message keeps a node of its own on every renderer, so a caller can
    // address it without knowing which one built the toast, and so a dismiss
    // control beside it does not join the toast's own textContent.
    var messageSpan = document.createElement('span');
    messageSpan.setAttribute('data-toast-message', '');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    var dismissAfter = resolveToastDismissal(duration, variant);
    // A toast that never expires carries the way out, and only that one: a
    // toast already on a timer has a way out, and giving it a button would
    // change its text for every reader of it.
    if (dismissAfter === null) {
      appendToastDismissControl(toast, container);
      container.appendChild(toast);
      return;
    }
    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, dismissAfter);
  }
`
