/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Footer link target (_self for internal, _blank for external)
 */
export const FooterLinkTargetSchema = Schema.Literal('_self', '_blank').annotations({
  description: 'Footer link target',
})

/**
 * Social media platforms (facebook, twitter, instagram, linkedin, youtube, github, tiktok)
 */
export const SocialPlatformSchema = Schema.Literal(
  'facebook',
  'twitter',
  'instagram',
  'linkedin',
  'youtube',
  'github',
  'tiktok'
).annotations({
  description: 'Social media platform',
})

/**
 * Footer link (label, href, optional target)
 */
export const FooterLinkSchema = Schema.Struct({
  label: Schema.String,
  href: Schema.String,
  target: Schema.optional(FooterLinkTargetSchema),
}).annotations({
  description: 'Footer link',
})

/**
 * Footer column (title and links array)
 */
export const FooterColumnSchema = Schema.Struct({
  title: Schema.String.annotations({
    description: 'Column heading',
  }),
  links: Schema.Array(FooterLinkSchema),
}).annotations({
  description: 'Footer column',
})

/**
 * Social media link (platform, url, optional custom icon)
 */
export const SocialLinkSchema = Schema.Struct({
  platform: SocialPlatformSchema,
  url: Schema.String.annotations({
    description: 'Social profile URL',
    format: 'uri',
  }),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Custom icon name if different from platform',
    })
  ),
}).annotations({
  description: 'Social media link',
})

/**
 * Social media section (optional title and links)
 */
export const SocialSectionSchema = Schema.Struct({
  title: Schema.optional(
    Schema.String.annotations({
      description: 'Social section title',
      default: 'Follow Us',
    })
  ),
  links: Schema.optional(Schema.Array(SocialLinkSchema)),
}).annotations({
  description: 'Social media section',
})

/**
 * Newsletter subscription (enabled, title, description, placeholder, buttonText)
 */
export const NewsletterSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether to show newsletter form',
      default: false,
    })
  ),
  title: Schema.optional(
    Schema.String.annotations({
      description: 'Newsletter title',
      default: 'Subscribe to our newsletter',
    })
  ),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Newsletter description',
    })
  ),
  placeholder: Schema.optional(
    Schema.String.annotations({
      description: 'Email input placeholder',
      default: 'Enter your email',
    })
  ),
  buttonText: Schema.optional(
    Schema.String.annotations({
      description: 'Submit button text',
      default: 'Subscribe',
    })
  ),
}).annotations({
  description: 'Newsletter subscription',
})

/**
 * Footer layout and content configuration
 *
 * Comprehensive footer with 5 sections: logo/description, columns, social, newsletter, copyright/legal
 *
 * @see specs/app/pages/layout/footer/footer.schema.json
 */
export const FooterSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether to show the footer',
      default: true,
    })
  ),
  logo: Schema.optional(
    Schema.String.annotations({
      description: 'Footer logo path',
    })
  ),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Company description or tagline',
    })
  ),
  backgroundColor: Schema.optional(
    Schema.String.annotations({
      description: 'Background color for footer (hex, rgb, or named color)',
    })
  ),
  textColor: Schema.optional(
    Schema.String.annotations({
      description: 'Text color for footer (hex, rgb, or named color)',
    })
  ),
  columns: Schema.optional(Schema.Array(FooterColumnSchema)),
  social: Schema.optional(SocialSectionSchema),
  newsletter: Schema.optional(NewsletterSchema),
  copyright: Schema.optional(
    Schema.String.annotations({
      description: 'Copyright text',
    })
  ),
  legal: Schema.optional(Schema.Array(FooterLinkSchema)),
  email: Schema.optional(
    Schema.String.annotations({
      description: 'Contact email address',
      format: 'email',
    })
  ),
}).annotations({
  title: 'Footer Configuration',
  description: 'Footer layout and content configuration',
})

// Type exports
export type FooterLinkTarget = Schema.Schema.Type<typeof FooterLinkTargetSchema>
export type SocialPlatform = Schema.Schema.Type<typeof SocialPlatformSchema>
export type FooterLink = Schema.Schema.Type<typeof FooterLinkSchema>
export type FooterColumn = Schema.Schema.Type<typeof FooterColumnSchema>
export type SocialLink = Schema.Schema.Type<typeof SocialLinkSchema>
export type SocialSection = Schema.Schema.Type<typeof SocialSectionSchema>
export type Newsletter = Schema.Schema.Type<typeof NewsletterSchema>
export type Footer = Schema.Schema.Type<typeof FooterSchema>
