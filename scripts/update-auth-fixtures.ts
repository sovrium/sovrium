/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { glob } from 'glob'

/**
 * Script to update auth test specs to use new fixtures
 * - Replaces signUp/signIn patterns with createAuthenticatedAdmin/createAuthenticatedUser
 * - Updates API key tests to use API key fixtures
 * - Updates two-factor tests to use two-factor fixtures
 * - Fixes lint issues (unused imports)
 */

type ReplacementRule = {
  pattern: RegExp
  replacement: string
  description: string
}

// Admin fixture replacements
const adminReplacements: ReplacementRule[] = [
  // Replace signUp + signIn with createAuthenticatedAdmin for admin users
  {
    pattern:
      /async \(\{\s*page,\s*startServerWithSchema,\s*signUp,\s*signIn\s*\}\) => \{([^]*?)await signUp\(\{\s*email: 'admin@example\.com',\s*password: '[^']*',\s*name: 'Admin User',?\s*\}\)(?:[^]*?)await signIn\(\{\s*email: 'admin@example\.com',\s*password: '[^']*',?\s*\}\)/g,
    replacement: `async ({ page, startServerWithSchema, createAuthenticatedAdmin }) => {$1await createAuthenticatedAdmin()`,
    description: 'Replace signUp + signIn with createAuthenticatedAdmin',
  },
  // Replace standalone signUp for admin with createAuthenticatedAdmin
  {
    pattern:
      /await signUp\(\{ email: 'admin@example\.com', password: '[^']*', name: 'Admin User' \}\)/g,
    replacement: 'await createAuthenticatedAdmin()',
    description: 'Replace standalone admin signUp',
  },
  // Replace unused signUp/signIn in function params
  {
    pattern: /async \(\{ page, startServerWithSchema, signUp, signIn \}\)/g,
    replacement:
      'async ({ page, startServerWithSchema, createAuthenticatedAdmin, createAuthenticatedUser })',
    description: 'Update function params for admin tests',
  },
]

// API Key fixture replacements
const apiKeyReplacements: ReplacementRule[] = [
  // Replace page.request.post with createApiKey fixture
  {
    pattern:
      /const response = await page\.request\.post\('\/api\/auth\/api-key\/create',\s*\{[^}]*data:\s*(\{[^}]*\})[^}]*\}\)/g,
    replacement: 'const apiKey = await createApiKey($1)',
    description: 'Replace API key create with fixture',
  },
  // Replace listApiKeys pattern
  {
    pattern: /const response = await page\.request\.post\('\/api\/auth\/api-key\/list'\)/g,
    replacement: 'const apiKeys = await listApiKeys()',
    description: 'Replace API key list with fixture',
  },
  // Replace deleteApiKey pattern
  {
    pattern:
      /await page\.request\.post\('\/api\/auth\/api-key\/delete',\s*\{\s*data:\s*\{\s*keyId:\s*([^}]+)\s*\}\s*\}\)/g,
    replacement: 'await deleteApiKey($1)',
    description: 'Replace API key delete with fixture',
  },
]

// Two-Factor fixture replacements
const twoFactorReplacements: ReplacementRule[] = [
  // Replace enableTwoFactor pattern
  {
    pattern:
      /const response = await page\.request\.post\('\/api\/auth\/two-factor\/enable'[^)]*\)/g,
    replacement: 'const setupData = await enableTwoFactor()',
    description: 'Replace 2FA enable with fixture',
  },
  // Replace verifyTwoFactor pattern
  {
    pattern:
      /await page\.request\.post\('\/api\/auth\/two-factor\/verify',\s*\{\s*data:\s*\{\s*code:\s*([^}]+)\s*\}\s*\}\)/g,
    replacement: 'await verifyTwoFactor($1)',
    description: 'Replace 2FA verify with fixture',
  },
  // Replace disableTwoFactor pattern
  {
    pattern:
      /await page\.request\.post\('\/api\/auth\/two-factor\/disable',\s*\{\s*data:\s*\{\s*code:\s*([^}]+)\s*\}\s*\}\)/g,
    replacement: 'await disableTwoFactor($1)',
    description: 'Replace 2FA disable with fixture',
  },
]

async function updateFile(filePath: string, replacements: ReplacementRule[]): Promise<boolean> {
  try {
    let content = readFileSync(filePath, 'utf-8')
    let modified = false

    for (const rule of replacements) {
      if (rule.pattern.test(content)) {
        content = content.replace(rule.pattern, rule.replacement)
        modified = true
        console.log(`  ✓ Applied: ${rule.description}`)
      }
    }

    if (modified) {
      writeFileSync(filePath, content, 'utf-8')
      return true
    }

    return false
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error)
    return false
  }
}

async function main() {
  console.log('🔧 Updating auth test specs to use new fixtures...\n')

  // Update admin tests
  console.log('📁 Updating admin tests...')
  const adminFiles = await glob('specs/api/auth/admin/**/*.spec.ts')
  let adminUpdated = 0
  for (const file of adminFiles) {
    console.log(`  Processing: ${file}`)
    if (await updateFile(file, adminReplacements)) {
      adminUpdated++
    }
  }
  console.log(`✓ Updated ${adminUpdated}/${adminFiles.length} admin test files\n`)

  // Update API key tests
  console.log('📁 Updating API key tests...')
  const apiKeyFiles = await glob('specs/api/auth/api-key/**/*.spec.ts')
  let apiKeyUpdated = 0
  for (const file of apiKeyFiles) {
    console.log(`  Processing: ${file}`)
    if (await updateFile(file, apiKeyReplacements)) {
      apiKeyUpdated++
    }
  }
  console.log(`✓ Updated ${apiKeyUpdated}/${apiKeyFiles.length} API key test files\n`)

  // Update two-factor tests
  console.log('📁 Updating two-factor tests...')
  const twoFactorFiles = await glob('specs/api/auth/two-factor/**/*.spec.ts')
  let twoFactorUpdated = 0
  for (const file of twoFactorFiles) {
    console.log(`  Processing: ${file}`)
    if (await updateFile(file, twoFactorReplacements)) {
      twoFactorUpdated++
    }
  }
  console.log(`✓ Updated ${twoFactorUpdated}/${twoFactorFiles.length} two-factor test files\n`)

  console.log(`✅ Done! Updated ${adminUpdated + apiKeyUpdated + twoFactorUpdated} total files`)
}

main().catch(console.error)
