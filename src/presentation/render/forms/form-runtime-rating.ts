/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline JS source for the rating scale of the standalone form runtime,
 * concatenated into the IIFE, whose `form` local it reuses.
 *
 * The scale is server-rendered as native radios laid over their glyphs
 * (`RatingInput` in `form-field-elements-typed.tsx`), which already gives a
 * radio group, keyboard selection and a posted value. This fragment adds the
 * two things native radios lack:
 *
 *   - choosing the CHOSEN rank again clears the rating. The checked state is
 *     read on `pointerdown` (or on the Space key), before the browser acts, so
 *     the `click` that follows knows whether the rank was already chosen. A
 *     cleared group posts nothing, and the column stores NULL — never 0, which
 *     its `CHECK (col >= 1)` refuses;
 *   - the glyphs up to the chosen rank are drawn filled, from the glyph pair
 *     and the two tone classes the server wrote on the group.
 *
 * `paintRatings()` is also called after a reset, so the glyphs follow the
 * radios the reset cleared.
 */
export const FORM_RUNTIME_RATING_SCRIPT = `
  // ---- Rating scales -----------------------------------------------------------
  var ratingArmed = null
  function ratingGroupOf(el) {
    return el && el.type === 'radio' && el.closest ? el.closest('[data-rating-scale]') : null
  }
  function paintRating(group) {
    var glyphs = group.getAttribute('data-rating-glyphs') || ''
    var chosen = group.querySelector('input:checked')
    var score = chosen ? Number(chosen.value) : 0
    group.querySelectorAll('[data-rating-glyph]').forEach(function (glyph, index) {
      var filled = index < score
      glyph.textContent = glyphs.charAt(filled ? 0 : 1)
      glyph.className = group.getAttribute(filled ? 'data-rating-filled-class' : 'data-rating-hollow-class') || ''
      glyph.setAttribute('data-filled', filled ? 'true' : 'false')
    })
  }
  function paintRatings() {
    form.querySelectorAll('[data-rating-scale]').forEach(paintRating)
  }
  function armRating(event) {
    if (event.type === 'keydown' && event.key !== ' ') return
    ratingArmed = ratingGroupOf(event.target) && event.target.checked ? event.target : null
  }
  form.addEventListener('pointerdown', armRating, true)
  form.addEventListener('keydown', armRating, true)
  form.addEventListener('click', function (event) {
    var group = ratingGroupOf(event.target)
    if (!group) return
    if (event.target === ratingArmed) {
      // The chosen rank chosen again: take the answer back.
      event.target.checked = false
      event.target.dispatchEvent(new Event('change', { bubbles: true }))
    }
    ratingArmed = null
    paintRating(group)
  })
  form.addEventListener('change', function (event) {
    var group = ratingGroupOf(event.target)
    if (group) paintRating(group)
  })
`
