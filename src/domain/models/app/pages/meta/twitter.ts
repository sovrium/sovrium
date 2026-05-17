/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ============================================================================
// Twitter Card
// ============================================================================

/**
 * Twitter Card type
 *
 * 4 card formats for different content types:
 * - summary: Small square image (144x144px, 1:1 aspect)
 * - summary_large_image: Large rectangular image (800x418px, 1.91:1)
 * - app: Mobile app promotion with install button
 * - player: Video/audio player embed
 */
export const TwitterCardTypeSchema = Schema.Literal(
  'summary',
  'summary_large_image',
  'app',
  'player'
).annotations({
  description: 'Type of Twitter Card',
})

/**
 * Twitter username pattern
 *
 * Twitter @username format: starts with @ followed by alphanumeric and underscores.
 */
export const TwitterUsernameSchema = Schema.String.pipe(
  Schema.pattern(/^@[A-Za-z0-9_]+$/, {
    message: () =>
      'Twitter username must start with @ and contain only letters, numbers, and underscores (e.g., @mysite, @johndoe)',
  })
).annotations({
  description: 'Twitter @username',
  examples: ['@mysite', '@johndoe'],
})

/**
 * App name configuration for Twitter App Card
 */
export const TwitterAppNameSchema = Schema.Struct({
  iPhone: Schema.optional(Schema.String.annotations({ description: 'App name for iPhone' })),
  iPad: Schema.optional(Schema.String.annotations({ description: 'App name for iPad' })),
  googlePlay: Schema.optional(
    Schema.String.annotations({ description: 'App name for Google Play' })
  ),
}).annotations({
  description: 'Name of app (for app cards)',
})

/**
 * App ID configuration for Twitter App Card
 */
export const TwitterAppIdSchema = Schema.Struct({
  iPhone: Schema.optional(Schema.String.annotations({ description: 'App Store ID for iPhone' })),
  iPad: Schema.optional(Schema.String.annotations({ description: 'App Store ID for iPad' })),
  googlePlay: Schema.optional(
    Schema.String.annotations({ description: 'Google Play package name (e.g., com.example.myapp)' })
  ),
}).annotations({
  description: 'App ID in respective stores',
})

/**
 * CORS setting for Twitter Card resources
 * @public
 */
export const TwitterCrossOriginSchema = Schema.Union(
  Schema.Boolean,
  Schema.Literal('anonymous', 'use-credentials')
).annotations({
  description: 'CORS setting for the resource',
})

/**
 * Twitter Card metadata for rich Twitter/X sharing
 *
 * Defines how pages appear when shared on Twitter/X platform.
 */
export const TwitterCardSchema = Schema.Struct({
  card: TwitterCardTypeSchema,
  title: Schema.optional(
    Schema.String.pipe(Schema.maxLength(70)).annotations({
      description: 'Twitter Card title',
    })
  ),
  description: Schema.optional(
    Schema.String.pipe(Schema.maxLength(200)).annotations({
      description: 'Twitter Card description',
    })
  ),
  image: Schema.optional(
    Schema.String.annotations({
      description: 'Image URL (min 144x144px for summary, 300x157px for large)',
      format: 'uri',
    })
  ),
  imageAlt: Schema.optional(
    Schema.String.pipe(Schema.maxLength(420)).annotations({
      description: 'Alternative text for the image',
    })
  ),
  site: Schema.optional(
    TwitterUsernameSchema.annotations({ description: 'Twitter @username of website' })
  ),
  creator: Schema.optional(
    TwitterUsernameSchema.annotations({ description: 'Twitter @username of content creator' })
  ),
  player: Schema.optional(
    Schema.String.annotations({
      description: 'HTTPS URL to video player (for player cards)',
      format: 'uri',
    })
  ),
  playerWidth: Schema.optional(
    Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
      description: 'Width of video player in pixels',
    })
  ),
  playerHeight: Schema.optional(
    Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
      description: 'Height of video player in pixels',
    })
  ),
  appName: Schema.optional(TwitterAppNameSchema),
  appId: Schema.optional(TwitterAppIdSchema),
}).annotations({
  title: 'Twitter Card Metadata',
  description: 'Twitter Card metadata for rich Twitter/X sharing',
})

/** @public */
export type TwitterCardType = Schema.Schema.Type<typeof TwitterCardTypeSchema>
/** @public */
export type TwitterUsername = Schema.Schema.Type<typeof TwitterUsernameSchema>
/** @public */
export type TwitterAppName = Schema.Schema.Type<typeof TwitterAppNameSchema>
/** @public */
export type TwitterAppId = Schema.Schema.Type<typeof TwitterAppIdSchema>
/** @public */
export type TwitterCard = Schema.Schema.Type<typeof TwitterCardSchema>
