/**
 * Happy DOM Setup for React Component Tests
 *
 * Import this file at the top of test files that need DOM APIs (document, window, etc.)
 * for React Testing Library.
 *
 * DO NOT preload globally - it interferes with server-side tests (URL resolution, etc.)
 *
 * @example
 * ```typescript
 * /// <reference lib="dom" />
 * import './happydom'
 * import { render, screen } from '@testing-library/react'
 * ```
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import '@testing-library/jest-dom'

GlobalRegistrator.register()
