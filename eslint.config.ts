/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import baseConfig from './eslint/base.config'
import boundariesConfig from './eslint/boundaries.config'
import drizzleConfig from './eslint/drizzle.config'
import fileNamingConfig from './eslint/file-naming.config'
import functionalConfig from './eslint/functional.config'
import importConfig from './eslint/import.config'
import infrastructureConfig from './eslint/infrastructure.config'
import playwrightConfig from './eslint/playwright.config'
import reactConfig from './eslint/react.config'
import scriptsConfig from './eslint/scripts.config'
import sizeLimitsConfig from './eslint/size-limits.config'
import testingConfig from './eslint/testing.config'
import typescriptConfig from './eslint/typescript.config'
import uiComponentsConfig from './eslint/ui-components.config'
import unicornConfig from './eslint/unicorn.config'
import type { Linter } from 'eslint'

export default [
  ...baseConfig,
  ...typescriptConfig,
  ...reactConfig,
  ...functionalConfig,
  ...importConfig,
  ...unicornConfig,
  ...fileNamingConfig,
  ...boundariesConfig,
  ...drizzleConfig,
  ...sizeLimitsConfig,
  ...uiComponentsConfig,
  ...infrastructureConfig,
  ...scriptsConfig,
  ...playwrightConfig,
  ...testingConfig, // Moved to end to ensure it has final override
] as Linter.Config[]
