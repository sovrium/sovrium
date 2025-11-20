/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-side banner dismiss functionality
 *
 * Immediately Invoked Function Expression (IIFE) that:
 * - Checks localStorage for banner dismissal state
 * - Hides banner if previously dismissed
 * - Attaches click handler to dismiss button
 * - Stores dismissal state in localStorage
 *
 * CSP-compliant: No inline event handlers, runs from external file
 */
;(function () {
  'use strict'

  const STORAGE_KEY = 'sovrium_banner-dismissed'

  // Check if banner was previously dismissed
  const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true'

  // Get banner element
  const banner = document.querySelector('[data-testid="banner"]')
  if (!banner) {
    return // No banner on this page
  }

  // Hide banner if previously dismissed
  if (isDismissed) {
    banner.style.display = 'none'
    return
  }

  // Get dismiss button
  const dismissButton = document.querySelector('[data-testid="banner-dismiss"]')
  if (!dismissButton) {
    return // Banner is not dismissible
  }

  // Handle dismiss button click
  dismissButton.addEventListener('click', function () {
    // Store dismissal state
    localStorage.setItem(STORAGE_KEY, 'true')

    // Hide banner
    banner.style.display = 'none'
  })
})()
