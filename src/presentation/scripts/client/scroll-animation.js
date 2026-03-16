/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-side scroll animation handler using IntersectionObserver
 *
 * Immediately Invoked Function Expression (IIFE) that:
 * - Detects elements with data-scroll-animation attribute
 * - Uses IntersectionObserver to watch when elements enter viewport
 * - Applies animation classes when elements become visible
 * - Respects threshold, once, and other configuration options
 *
 * CSP-compliant: No inline event handlers, runs from external file
 */
;(function () {
  'use strict'

  /**
   * Initialize scroll animations with IntersectionObserver
   * Observes all elements with data-scroll-animation attribute
   */
  function init() {
    // Find all elements that should animate on scroll
    const animatedElements = document.querySelectorAll('[data-scroll-animation]')

    if (animatedElements.length === 0) {
      return
    }

    // Process each element to create observers with custom thresholds
    animatedElements.forEach((element) => {
      const animationName = element.getAttribute('data-scroll-animation')
      const threshold = parseFloat(element.getAttribute('data-scroll-threshold') || '0.1')
      const delay = element.getAttribute('data-scroll-delay') || '0ms'
      const duration = element.getAttribute('data-scroll-duration') || '600ms'
      const once = element.getAttribute('data-scroll-once') !== 'false'

      // Apply animation delay and duration via inline styles (if non-default)
      if (delay !== '0ms') {
        element.style.animationDelay = delay
      }
      if (duration !== '600ms') {
        element.style.animationDuration = duration
      }

      // Check if element is initially in viewport
      const rect = element.getBoundingClientRect()
      const isInitiallyVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)

      // Track if we should apply scroll animation
      // For initially visible elements, don't apply scroll animation at all
      let shouldSkipScrollAnimation = isInitiallyVisible

      // Create observer for this element with its specific threshold
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const animationClass = `animate-${animationName}`

            if (entry.isIntersecting) {
              // Skip scroll animation for elements that are initially visible
              // This preserves entrance animations
              if (shouldSkipScrollAnimation) {
                return
              }

              // Remove any existing animation classes (including entrance animations)
              // This allows scroll animation to replace entrance animation
              const existingAnimationClasses = Array.from(element.classList).filter((cls) =>
                cls.startsWith('animate-')
              )
              existingAnimationClasses.forEach((cls) => {
                element.classList.remove(cls)
              })

              // Add the scroll animation class
              element.classList.add(animationClass)

              // If once is true, stop observing
              if (once) {
                observer.unobserve(element)
              }
            } else {
              // Element left viewport, mark that scroll animation should apply on next intersection
              shouldSkipScrollAnimation = false

              if (!once) {
                // Element left viewport and once is false, remove animation class for re-trigger
                if (element.classList.contains(animationClass)) {
                  element.classList.remove(animationClass)
                }
              }
            }
          })
        },
        {
          threshold: threshold,
          rootMargin: '0px',
        }
      )

      // Start observing this element
      observer.observe(element)
    })
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    // DOM already loaded
    init()
  }
})()
