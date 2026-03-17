/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Twitter Card type
 *
 * 4 card formats for different content types:
 * - summary: Small square image (144x144px, 1:1 aspect) - compact card for brief updates
 * - summary_large_image: Large rectangular image (800x418px, 1.91:1) - most popular, highest engagement
 * - app: Mobile app promotion with install button - links to App Store/Google Play
 * - player: Video/audio player embed - plays inline in Twitter feed
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
 * - Pattern: ^@[A-Za-z0-9_]+$ (must start with @)
 * - Valid: @mysite, @johndoe, @acmeblog123
 * - Invalid: mysite (missing @), @my-site (hyphen not allowed)
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
 *
 * App names per platform (iPhone, iPad, Google Play).
 * Used in App Card to show app name and link to app store.
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
 *
 * App Store IDs per platform (iPhone, iPad, Google Play).
 * Used in App Card to link directly to app store listing.
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
 *
 * 3 options:
 * - true: Anonymous CORS (no credentials)
 * - false: No CORS
 * - 'anonymous': Explicit anonymous CORS
 * - 'use-credentials': CORS with credentials
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
 * Creates rich preview cards with images, titles, and descriptions to
 * dramatically increase engagement and click-through rates.
 *
 * Required properties:
 * - card: Card type (summary, summary_large_image, app, player)
 *
 * Optional properties:
 * - title: Card title (max 70 chars, shorter than Open Graph's 90)
 * - description: Card description (max 200 chars, same as Open Graph)
 * - image: Image URL (min 144x144px for summary, 300x157px for large)
 * - imageAlt: Image alternative text (max 420 chars, longer than Open Graph)
 * - site: Twitter @username of website (e.g., @acmeblog)
 * - creator: Twitter @username of content author (e.g., @johndoe)
 *
 * Player card properties (for video/audio):
 * - player: HTTPS URL to player iframe
 * - playerWidth: Player width in pixels
 * - playerHeight: Player height in pixels
 *
 * App card properties (for mobile apps):
 * - appName: App names per platform (iPhone, iPad, Google Play)
 * - appId: App Store IDs per platform
 *
 * Card types comparison:
 * 1. **summary**: Small square image (144x144px), compact format
 *    - Good for: news updates, blog posts, simple links
 *    - Layout: [Square image] [Title + Description]
 *
 * 2. **summary_large_image**: Large rectangular image (800x418px), most popular
 *    - Good for: featured content, product launches, visual content
 *    - Layout: [Large image full width] [Title] [Description]
 *    - Highest engagement (most popular card type)
 *
 * 3. **app**: Mobile app promotion with install button
 *    - Good for: app launches, mobile-first products
 *    - Layout: [App icon] [Title + Description] [Install button]
 *    - Click: opens App Store/Google Play directly
 *
 * 4. **player**: Video/audio player embed
 *    - Good for: video content, podcasts, demos
 *    - Layout: [Video thumbnail] [Play button]
 *    - Click: embeds player iframe inline in Twitter feed
 *
 * Impact:
 * - Rich cards get 2-3x more clicks than plain links
 * - Large image card most effective (highest engagement)
 * - Without Twitter Card: falls back to Open Graph or generic unfurl
 *
 * @example
 * ```typescript
 * const twitterCard = {
 *   card: 'summary_large_image',
 *   title: 'Transform Your Business with AI-Powered Analytics',
 *   description: 'Get real-time insights and automated reporting. Start free trial.',
 *   image: 'https://example.com/twitter-800x418.jpg',
 *   imageAlt: 'Dashboard screenshot showing analytics graphs',
 *   site: '@acmeanalytics',
 *   creator: '@johndoe'
 * }
 * ```
 *
 * @see specs/app/pages/meta/social/twitter-card.schema.json
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

export type TwitterCardType = Schema.Schema.Type<typeof TwitterCardTypeSchema>
export type TwitterUsername = Schema.Schema.Type<typeof TwitterUsernameSchema>
export type TwitterAppName = Schema.Schema.Type<typeof TwitterAppNameSchema>
export type TwitterAppId = Schema.Schema.Type<typeof TwitterAppIdSchema>
export type TwitterCard = Schema.Schema.Type<typeof TwitterCardSchema>
