/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import boundaries from 'eslint-plugin-boundaries'
import type { Linter } from 'eslint'

export default [
  // Layer-based Architecture - Granular boundary enforcement
  // Based on: docs/architecture/layer-based-architecture/13-file-structure.md
  //
  // Dependency Direction: Presentation → Application → Domain ← Infrastructure
  //
  // Key Rules:
  // 1. Presentation depends on Application + Domain (NOT Infrastructure directly)
  // 2. Application depends on Domain + Ports (defines Infrastructure interfaces)
  // 3. Domain depends on NOTHING (pure, self-contained)
  // 4. Infrastructure depends ONLY on Domain + Ports (strict dependency inversion)
  // 5. Feature Isolation: domain/models/table ≠> domain/models/automation (strict)
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/ignore': ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      'boundaries/elements': [
        // ==========================================
        // DOMAIN LAYER - Feature Models (STRICT ISOLATION)
        // ==========================================
        // App model - Root level only (name.ts, description.ts, version.ts, index.ts, tables.ts)
        {
          type: 'domain-model-app',
          pattern: 'src/domain/models/app/*.{ts,tsx}',
          mode: 'file',
        },
        // Feature models - Nested under app/
        {
          type: 'domain-model-table',
          pattern: 'src/domain/models/app/table/**/*',
          mode: 'file',
        },
        { type: 'domain-model-page', pattern: 'src/domain/models/app/page/**/*', mode: 'file' },
        {
          type: 'domain-model-automation',
          pattern: 'src/domain/models/app/automation/**/*',
          mode: 'file',
        },

        // DOMAIN LAYER - Shared Utilities
        { type: 'domain-validator', pattern: 'src/domain/validators/**/*', mode: 'file' },
        { type: 'domain-service', pattern: 'src/domain/services/**/*', mode: 'file' },
        { type: 'domain-factory', pattern: 'src/domain/factories/**/*', mode: 'file' },

        // DOMAIN LAYER - API Contracts (Zod for OpenAPI)
        { type: 'domain-model-api', pattern: 'src/domain/models/api/**/*', mode: 'file' },

        // DOMAIN LAYER - Pure Utilities (format detection, content parsing)
        { type: 'domain-util', pattern: 'src/domain/utils/**/*', mode: 'file' },

        // ==========================================
        // APPLICATION LAYER - Use Cases (Phase-based)
        // ==========================================
        {
          type: 'application-use-case-server',
          pattern: 'src/application/use-cases/server/**/*',
          mode: 'file',
        },
        {
          type: 'application-use-case-config',
          pattern: 'src/application/use-cases/config/**/*',
          mode: 'file',
        },
        {
          type: 'application-use-case-database',
          pattern: 'src/application/use-cases/database/**/*',
          mode: 'file',
        },
        {
          type: 'application-use-case-auth',
          pattern: 'src/application/use-cases/auth/**/*',
          mode: 'file',
        },
        {
          type: 'application-use-case-routing',
          pattern: 'src/application/use-cases/routing/**/*',
          mode: 'file',
        },
        {
          type: 'application-use-case-automation',
          pattern: 'src/application/use-cases/automation/**/*',
          mode: 'file',
        },
        {
          type: 'application-use-case',
          pattern: 'src/application/use-cases/**/*',
          mode: 'file',
        }, // Fallback

        // APPLICATION LAYER - Ports & Services
        { type: 'application-port', pattern: 'src/application/ports/**/*', mode: 'file' },
        { type: 'application-service', pattern: 'src/application/services/**/*', mode: 'file' },
        { type: 'application-error', pattern: 'src/application/errors/**/*', mode: 'file' },

        // ==========================================
        // INFRASTRUCTURE LAYER - Service Organization
        // ==========================================
        {
          type: 'infrastructure-config',
          pattern: 'src/infrastructure/config/**/*',
          mode: 'file',
        },
        {
          type: 'infrastructure-database',
          pattern: 'src/infrastructure/database/**/*',
          mode: 'file',
        },
        { type: 'infrastructure-auth', pattern: 'src/infrastructure/auth/**/*', mode: 'file' },
        { type: 'infrastructure-email', pattern: 'src/infrastructure/email/**/*', mode: 'file' },
        {
          type: 'infrastructure-storage',
          pattern: 'src/infrastructure/storage/**/*',
          mode: 'file',
        },
        {
          type: 'infrastructure-webhooks',
          pattern: 'src/infrastructure/webhooks/**/*',
          mode: 'file',
        },
        {
          type: 'infrastructure-logging',
          pattern: 'src/infrastructure/logging/**/*',
          mode: 'file',
        },
        { type: 'infrastructure-server', pattern: 'src/infrastructure/server/**/*', mode: 'file' },
        { type: 'infrastructure-css', pattern: 'src/infrastructure/css/**/*', mode: 'file' },
        {
          type: 'infrastructure-service',
          pattern: 'src/infrastructure/services/**/*',
          mode: 'file',
        },
        { type: 'infrastructure-layer', pattern: 'src/infrastructure/layers/**/*', mode: 'file' },

        // ==========================================
        // PRESENTATION LAYER - API vs Components
        // ==========================================
        {
          type: 'presentation-api-route',
          pattern: 'src/presentation/api/routes/**/*',
          mode: 'file',
        },
        {
          type: 'presentation-api-middleware',
          pattern: 'src/presentation/api/middleware/**/*',
          mode: 'file',
        },
        { type: 'presentation-util', pattern: 'src/presentation/utils/**/*', mode: 'file' },
        {
          type: 'presentation-api-util',
          pattern: 'src/presentation/api/utils/**/*',
          mode: 'file',
        },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // ==========================================
            // DOMAIN LAYER - STRICT FEATURE ISOLATION
            // ==========================================

            // App model (root) - Can import feature models for composition
            {
              from: ['domain-model-app'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-model-api',
                'domain-util',
              ],
              message:
                'App model violation: Can import feature models (table, page, automation) for schema composition.',
            },

            // Feature models - ONLY import from app model (NO CROSS-FEATURE IMPORTS)
            {
              from: ['domain-model-table'],
              allow: ['domain-model-app', 'domain-model-table', 'domain-model-api', 'domain-util'],
              message:
                'Table model violation: Can only import from app model. FORBIDDEN: Cannot import from page/automation models (strict feature isolation).',
            },
            {
              from: ['domain-model-page'],
              allow: ['domain-model-app', 'domain-model-page', 'domain-model-api', 'domain-util'],
              message:
                'Page model violation: Can only import from app model. FORBIDDEN: Cannot import from table/automation models (strict feature isolation).',
            },
            {
              from: ['domain-model-automation'],
              allow: [
                'domain-model-app',
                'domain-model-automation',
                'domain-model-api',
                'domain-util',
              ],
              message:
                'Automation model violation: Can only import from app model. FORBIDDEN: Cannot import from table/page models (strict feature isolation).',
            },

            // Domain validators - Can import all domain models + other validators
            {
              from: ['domain-validator'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-model-api',
                'domain-util',
              ],
              message:
                'Domain validator violation: Can only import domain models and other validators. No application/infrastructure dependencies.',
            },

            // Domain services - Can import models, validators, other services
            {
              from: ['domain-service'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-model-api',
                'domain-util',
              ],
              message:
                'Domain service violation: Can only import domain models, validators, and other services. Must remain pure.',
            },

            // Domain factories - Can import models, validators, services, other factories
            {
              from: ['domain-factory'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
              ],
              message:
                'Domain factory violation: Can only import domain models, validators, services, and other factories.',
            },

            // Domain API contracts - Can import domain models (for type references) and domain utils
            {
              from: ['domain-model-api'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-model-api',
                'domain-util',
              ],
              message:
                'Domain API contract violation: Can only import domain models and domain utils. Keep API schema definitions pure.',
            },

            // Domain utilities - Can import domain models and other utils
            {
              from: ['domain-util'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-util',
              ],
              message:
                'Domain util violation: Can only import domain models and other utils. Keep utilities pure.',
            },

            // ==========================================
            // APPLICATION LAYER - USE CASES
            // ==========================================

            // Use cases - Can import domain + ports + other application + infrastructure (Phase 1 pragmatic)
            // TODO(Phase 2): Refactor to use ports pattern for infrastructure dependencies
            {
              from: [
                'application-use-case-server',
                'application-use-case-config',
                'application-use-case-database',
                'application-use-case-auth',
                'application-use-case-routing',
                'application-use-case-automation',
                'application-use-case',
              ],
              allow: [
                // All domain
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                // Application layer
                'application-port',
                'application-service',
                'application-error',
                // Other use cases
                'application-use-case-server',
                'application-use-case-config',
                'application-use-case-database',
                'application-use-case-auth',
                'application-use-case-routing',
                'application-use-case-automation',
                'application-use-case',
                // Infrastructure (Phase 1 pragmatic - TODO: refactor to ports)
                'infrastructure-config',
                'infrastructure-database',
                'infrastructure-auth',
                'infrastructure-email',
                'infrastructure-storage',
                'infrastructure-webhooks',
                'infrastructure-logging',
                'infrastructure-server',
                'infrastructure-css',
                'infrastructure-service',
              ],
              message:
                'Use case violation: Can import domain, application, and infrastructure (Phase 1). TODO: Refactor to use ports pattern for cleaner dependency inversion.',
            },

            // Application ports - Can import domain + other ports (interface definitions)
            {
              from: ['application-port'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                'application-port', // Ports can reference other port interfaces
              ],
              message:
                'Port violation: Can only import domain models and other ports for interface definitions. Keep ports lightweight.',
            },

            // Application services - Can import domain + ports + use-cases + infrastructure (utilities)
            {
              from: ['application-service'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                'application-port',
                'application-error',
                'application-service',
                // Allow use-cases for cross-cutting utilities
                'application-use-case-server',
                'application-use-case-config',
                'application-use-case-database',
                'application-use-case-auth',
                'application-use-case-routing',
                'application-use-case-automation',
                'application-use-case',
                // Allow infrastructure for utility services
                'infrastructure-config',
                'infrastructure-database',
                'infrastructure-auth',
                'infrastructure-email',
                'infrastructure-storage',
                'infrastructure-webhooks',
                'infrastructure-logging',
                'infrastructure-server',
                'infrastructure-css',
                'infrastructure-service',
              ],
              message:
                'Application service violation: Can import domain, ports, use-cases, and infrastructure. Use for cross-cutting utilities only.',
            },

            // Application errors - Can import domain + use-cases + infrastructure (cross-cutting concern)
            {
              from: ['application-error'],
              allow: [
                // Domain models
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-model-api',
                'domain-util',
                // Application errors (error classes and handlers can import each other)
                'application-error',
                // Application use-cases (for error type imports)
                'application-use-case-server',
                'application-use-case-config',
                'application-use-case-database',
                'application-use-case-auth',
                'application-use-case-routing',
                'application-use-case-automation',
                'application-use-case',
                // Infrastructure (for error type imports)
                'infrastructure-config',
                'infrastructure-database',
                'infrastructure-auth',
                'infrastructure-email',
                'infrastructure-storage',
                'infrastructure-webhooks',
                'infrastructure-logging',
                'infrastructure-server',
                'infrastructure-css',
                'infrastructure-service',
              ],
              message:
                'Application error violation: Error handlers are cross-cutting concerns. Can import domain models, use-case errors, and infrastructure errors.',
            },

            // ==========================================
            // INFRASTRUCTURE LAYER - STRICT PORTS PATTERN
            // ==========================================

            // Infrastructure services - Can import domain + ports + other infrastructure
            // Note: infrastructure-server can also import presentation for route composition (wiring)
            {
              from: [
                'infrastructure-config',
                'infrastructure-database',
                'infrastructure-auth',
                'infrastructure-email',
                'infrastructure-storage',
                'infrastructure-webhooks',
                'infrastructure-logging',
                'infrastructure-server',
                'infrastructure-css',
                'infrastructure-service',
              ],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                'application-port', // ONLY ports, NOT use-cases
                // Exception: Allow infrastructure-server to import analytics use cases for purge middleware
                // This is needed for analytics retention cleanup middleware in server.ts
                'application-use-case', // Fallback type for analytics use cases
                // Allow infrastructure services to import each other
                'infrastructure-config',
                'infrastructure-database',
                'infrastructure-auth',
                'infrastructure-email',
                'infrastructure-storage',
                'infrastructure-webhooks',
                'infrastructure-logging',
                'infrastructure-server',
                'infrastructure-css',
                'infrastructure-service',
                'infrastructure-layer',
                // Allow infrastructure-server to import presentation for route composition (wiring)
                // This is pragmatic - server startup needs to compose routes from presentation layer
                'presentation-api-route',
                'presentation-api-middleware',
              ],
              message:
                'Infrastructure violation: Can only import domain, application/ports, and other infrastructure services. Exceptions: infrastructure-server can import presentation for route wiring.',
            },

            // Infrastructure layers - Special case, can import all infrastructure for Effect Layer composition
            {
              from: ['infrastructure-layer'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                'application-port',
                'infrastructure-config',
                'infrastructure-database',
                'infrastructure-auth',
                'infrastructure-email',
                'infrastructure-storage',
                'infrastructure-webhooks',
                'infrastructure-logging',
                'infrastructure-server',
                'infrastructure-css',
                'infrastructure-service',
                'infrastructure-layer', // Allow layers to import other layers for composition
              ],
              message:
                'Infrastructure layer composition: Can import domain, ports, and all infrastructure services for Effect Layer composition.',
            },

            // ==========================================
            // PRESENTATION LAYER
            // ==========================================

            // API routes - Can import use cases, domain, other presentation
            {
              from: ['presentation-api-route'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                'application-port', // Port types (Session, repository interfaces)
                'application-use-case-server',
                'application-use-case-config',
                'application-use-case-database',
                'application-use-case-auth',
                'application-use-case-routing',
                'application-use-case-automation',
                'application-use-case',
                'application-error',
                'infrastructure-database', // Composition root: routes provide Live layers to Effect programs
                'presentation-api-middleware',
                'presentation-api-util',
                'presentation-util',
              ],
              message:
                'API route violation: Can import domain, application use cases/ports, and infrastructure layers (composition root). FORBIDDEN: Direct infrastructure query imports.',
            },

            // API middleware - Can import domain, application errors/use-cases/ports, other middleware, logging
            {
              from: ['presentation-api-middleware'],
              allow: [
                'domain-model-app',
                'domain-model-api',
                'domain-util',
                'application-port', // Port types (Session, service interfaces)
                'application-error',
                'application-use-case', // Middleware may enrich context via application services
                'infrastructure-logging', // Cross-cutting concern: structured logging
                'presentation-api-middleware',
                'presentation-util',
              ],
              message:
                'API middleware violation: Can import domain models/errors, application ports/errors/use-cases, logging, and other middleware.',
            },

            // Presentation utils - Can import domain only
            {
              from: ['presentation-util'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-model-api',
                'domain-util',
                'presentation-util',
              ],
              message:
                'Presentation util violation: Can only import domain models and other utils. Keep utilities pure.',
            },

            // API utils - Can import domain, application ports, other presentation utils, and logging
            {
              from: ['presentation-api-util'],
              allow: [
                'domain-model-app',
                'domain-model-table',
                'domain-model-page',
                'domain-model-automation',
                'domain-validator',
                'domain-service',
                'domain-factory',
                'domain-model-api',
                'domain-util',
                'application-port', // Port types (Session, service interfaces)
                'infrastructure-logging', // Cross-cutting concern: structured logging
                'presentation-api-util',
                'presentation-api-middleware',
                'presentation-util',
              ],
              message:
                'API util violation: Cannot import from Infrastructure layer (except logging). Use Application layer ports/use cases instead.',
            },
          ],
        },
      ],
    },
  },
] satisfies Linter.Config[]
