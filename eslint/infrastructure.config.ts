/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Linter } from 'eslint'

export default [
  // Infrastructure Layer - Services need side effects
  {
    files: ['src/infrastructure/**/*.{ts,tsx}'],
    rules: {
      // Infrastructure needs side effects for I/O
      'functional/no-expression-statements': [
        'warn',
        {
          ignoreVoid: true,
          ignoreCodePattern: ['console\\.', 'server\\.', 'app\\.', 'Bun\\.'],
        },
      ],

      // External libraries often use mutable types
      'functional/prefer-immutable-types': [
        'warn',
        {
          enforcement: 'ReadonlyShallow',
          ignoreInferredTypes: true,
          ignoreClasses: true,
        },
      ],
    },
  },

  // Effect.ts Domain Layer Restriction - Enforce pure domain layer
  // Domain layer must be pure functions with zero dependencies
  // ALLOWED: Schema from 'effect' (for validation, no side effects)
  // FORBIDDEN: Effect, Context, Layer (side effects and orchestration)
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'effect',
              importNames: ['Effect', 'Context', 'Layer', 'pipe', 'flow'],
              message:
                'Domain layer must be pure - no Effect programs (Effect, Context, Layer) allowed. Use Effect in Application layer (use-cases) for side effects and orchestration. ALLOWED: Schema for validation. See docs/architecture/layer-based-architecture/08-layer-3-domain-layer-business-logic.md',
            },
          ],
          patterns: [
            {
              group: ['effect/Effect', 'effect/Context', 'effect/Layer'],
              message:
                'Domain layer must be pure - no Effect programs allowed. Use Effect in Application layer. See docs/architecture/layer-based-architecture/08-layer-3-domain-layer-business-logic.md',
            },
          ],
        },
      ],
    },
  },

  // Zod Restriction - Forbid Zod usage in src/ (except presentation layer)
  // Project standard: Effect Schema for server validation
  // EXCEPTION: src/presentation allows Zod for:
  // - API schemas and OpenAPI/Hono integration (src/presentation/api/schemas)
  // - Client forms (React Hook Form)
  // - API route validation (@hono/zod-validator)
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/presentation/**/*.{ts,tsx}', // Exception for presentation layer (forms, API routes, OpenAPI)
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'zod',
              message:
                'Zod is restricted in src/ - use Effect Schema for server validation. EXCEPTION: Zod is allowed in src/presentation for OpenAPI/Hono integration and client forms.',
            },
            {
              name: '@hono/zod-validator',
              message:
                'Zod validator is restricted in src/ - use Effect Schema for validation. EXCEPTION: @hono/zod-validator is allowed in src/presentation/api/routes for API validation.',
            },
          ],
        },
      ],
    },
  },

  // Zod Allowed - Presentation layer exception
  // Presentation layer can use Zod for:
  // - Client-side form validation (React Hook Form)
  // - API route validation (@hono/zod-validator)
  // - OpenAPI schema generation
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off', // Allow Zod, @hono/zod-validator, @hookform/resolvers
    },
  },

  // Use Case Organization Hints - Suggest phase-based structure
  // Warn when use cases are in flat directory instead of phase subdirectories
  // This is a suggestion, not a hard requirement (warnings, not errors)
  {
    files: ['src/application/use-cases/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Program',
          message:
            'Consider organizing use cases into phase subdirectories (server/, config/, database/, auth/, routing/, automation/) for better structure. See docs/architecture/layer-based-architecture/13-file-structure.md#phase-based-use-case-organization',
        },
      ],
    },
  },
] satisfies Linter.Config[]
