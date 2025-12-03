# Nodemailer v7.0.11

## Overview

Nodemailer is the SMTP email sending library for the Sovrium project. It provides a Promise-based API for sending emails with support for HTML templates, attachments, and various SMTP transports.

## Installation

```bash
bun add nodemailer
bun add -D @types/nodemailer
```

## Configuration

### Environment Variables

| Variable       | Required   | Default             | Purpose                             |
| -------------- | ---------- | ------------------- | ----------------------------------- |
| SMTP_HOST      | Production | 127.0.0.1           | SMTP server hostname                |
| SMTP_PORT      | No         | 587                 | SMTP server port (587=TLS, 465=SSL) |
| SMTP_SECURE    | No         | false               | Use SSL (auto-detected from port)   |
| SMTP_USER      | No         | ''                  | SMTP authentication username        |
| SMTP_PASS      | No         | ''                  | SMTP authentication password        |
| SMTP_FROM      | No         | noreply@sovrium.com | Default sender email                |
| SMTP_FROM_NAME | No         | Sovrium             | Default sender name                 |

### Configuration Files

| File                                        | Purpose                      | Key Settings                        |
| ------------------------------------------- | ---------------------------- | ----------------------------------- |
| `src/infrastructure/email/email-config.ts`  | Environment variable parsing | Type-safe config with defaults      |
| `src/infrastructure/email/nodemailer.ts`    | Transporter creation         | Pre-configured nodemailer instance  |
| `src/infrastructure/email/email-service.ts` | Effect service layer         | Effect-based API wrapper            |
| `src/infrastructure/email/templates.ts`     | Email templates              | HTML/text templates for Better Auth |
| `src/infrastructure/email/index.ts`         | Module exports               | Public API exports                  |

### Development vs Production

**Development (no SMTP_HOST set)**:

- Automatically uses Mailpit at 127.0.0.1:1025
- No authentication required
- All emails captured locally
- View at http://localhost:8025

**Production (SMTP_HOST configured)**:

- Uses real SMTP server
- Requires authentication (SMTP_USER, SMTP_PASS)
- Emails sent to actual recipients
- Errors logged via Effect logging

## Usage

### 1. Direct Usage (async/await)

For non-Effect code like Better Auth callbacks:

```typescript
import { sendEmail } from '@/infrastructure/email'

await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>',
  text: 'Welcome!',
})
```

### 2. Effect Service Usage

For application layer workflows:

```typescript
import { Email, EmailLive } from '@/infrastructure/email'
import { Effect } from 'effect'

const program = Effect.gen(function* () {
  const email = yield* Email

  // Send with default "from" address
  yield* email.sendWithDefaultFrom({
    to: 'user@example.com',
    subject: 'Welcome',
    html: '<h1>Welcome!</h1>',
  })

  // Send with custom "from" address
  yield* email.send({
    from: '"Custom Name" <custom@example.com>',
    to: 'user@example.com',
    subject: 'Hello',
    text: 'Hello World',
  })

  // Verify SMTP connection
  const isConnected = yield* email.verifyConnection()
})

// Run with EmailLive layer
const result = await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
```

### 3. Using Email Templates

```typescript
import { sendEmail, passwordResetEmail } from '@/infrastructure/email'

// Generate template (returns { subject, html, text })
const template = passwordResetEmail({
  userName: 'John',
  resetUrl: 'https://app.sovrium.com/reset?token=abc123',
  expiresIn: '1 hour',
})

// Send email with template
await sendEmail({
  to: 'john@example.com',
  ...template, // Spreads subject, html, text
})
```

## Integration with Better Auth

Nodemailer is integrated with Better Auth for password reset and email verification flows.

### Password Reset Flow

```typescript
// src/infrastructure/auth/better-auth/auth.ts
import { betterAuth } from 'better-auth'
import { sendEmail, passwordResetEmail } from '@/infrastructure/email'

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      const template = passwordResetEmail({
        userName: user.name,
        resetUrl: url,
        expiresIn: '1 hour',
      })

      await sendEmail({
        to: user.email,
        ...template,
      })
    },
  },
})
```

### Email Verification Flow

```typescript
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      const template = emailVerificationEmail({
        userName: user.name,
        verifyUrl: url,
        expiresIn: '24 hours',
      })

      await sendEmail({
        to: user.email,
        ...template,
      })
    },
  },
})
```

## Integration with Mailpit (Local Development)

Mailpit is the recommended local email testing tool. See `@docs/infrastructure/email/mailpit.md` for setup.

**Quick Start**:

```bash
# Start Mailpit (Docker)
docker run -d --name=mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit

# Configure environment
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false

# Send test email
await sendEmail({
  to: 'test@example.com',
  subject: 'Test',
  html: '<h1>Hello</h1>',
})

# View at http://localhost:8025
```

## Available Email Templates

Three templates are provided in `src/infrastructure/email/templates.ts`:

### 1. Password Reset Email

```typescript
passwordResetEmail({
  userName: 'John', // Optional
  resetUrl: 'https://...', // Required
  expiresIn: '1 hour', // Optional (default: '1 hour')
})
```

### 2. Email Verification

```typescript
emailVerificationEmail({
  userName: 'John', // Optional
  verifyUrl: 'https://...', // Required
  expiresIn: '24 hours', // Optional (default: '24 hours')
})
```

### 3. Organization Invite

```typescript
organizationInviteEmail({
  inviterName: 'Jane', // Optional
  organizationName: 'Acme Corp', // Required
  inviteUrl: 'https://...', // Required
  role: 'member', // Optional
  expiresIn: '7 days', // Optional (default: '7 days')
})
```

## Error Handling

### Effect-based Errors

```typescript
import { Email, EmailLive, EmailError } from '@/infrastructure/email'
import { Effect } from 'effect'

const program = Effect.gen(function* () {
  const email = yield* Email

  yield* email.sendWithDefaultFrom({
    to: 'invalid-email',
    subject: 'Test',
    text: 'Test',
  })
}).pipe(
  Effect.catchTag('EmailError', (error) => {
    console.error('Failed to send email:', error.message)
    return Effect.succeed(null)
  })
)
```

### Async/await Errors

```typescript
import { sendEmail } from '@/infrastructure/email'

try {
  await sendEmail({
    to: 'user@example.com',
    subject: 'Test',
    text: 'Test',
  })
} catch (error) {
  console.error('Email send failed:', error)
}
```

## Best Practices

1. **Use Mailpit for local development** - Faster than Ethereal, no internet required
2. **Always provide text alternatives** - Include both `html` and `text` fields
3. **Use email templates** - Consistent styling via `templates.ts` functions
4. **Verify connections at startup** - Call `verifyConnection()` during app initialization
5. **Use Effect service in application layer** - Effect-based error handling and composition
6. **Use async/await in presentation layer** - Better Auth callbacks require Promise-based API
7. **Configure SMTP via environment** - Never hardcode SMTP credentials in code
8. **Test emails locally** - Use Mailpit to verify rendering before production deployment
9. **Include expiry information** - Always communicate link expiration to users
10. **Sanitize user input** - Email content from user input should be escaped

## Architecture Integration

### Layer-Based Architecture

| Layer              | Usage          | Pattern                                    |
| ------------------ | -------------- | ------------------------------------------ |
| **Domain**         | Not used       | Business logic is email-agnostic           |
| **Application**    | Effect service | Use `Email` service with `EmailLive` layer |
| **Infrastructure** | Implementation | Nodemailer transporter, templates          |
| **Presentation**   | Direct usage   | Better Auth callbacks use `sendEmail()`    |

### Effect Integration

Nodemailer is wrapped in an Effect service for:

- Type-safe error handling (`EmailError`, `EmailConnectionError`)
- Dependency injection via `Email` tag
- Composable workflows with other Effect services
- Automatic error logging

```typescript
// Effect service provides typed errors
const program = Effect.gen(function* () {
  const email = yield* Email
  yield* email.sendWithDefaultFrom(options)
})

// Can be composed with other Effect services
const workflow = Effect.gen(function* () {
  const email = yield* Email
  const db = yield* Database

  // Send email + update database in transaction
  yield* Effect.all([email.sendWithDefaultFrom(emailOptions), db.updateEmailSentAt(userId)])
})
```

## Troubleshooting

| Issue                 | Solution                                     |
| --------------------- | -------------------------------------------- |
| Connection timeout    | Check SMTP_HOST and firewall settings        |
| Authentication failed | Verify SMTP_USER and SMTP_PASS credentials   |
| Port already in use   | Stop other SMTP services or change SMTP_PORT |
| Emails not appearing  | Ensure Mailpit is running: `docker ps`       |
| SSL errors            | Use SMTP_SECURE=false for port 587           |
| IPv6 errors           | Use 127.0.0.1 instead of localhost           |
| Rate limiting         | Check SMTP provider limits (Gmail: 500/day)  |
| Emails in spam        | Configure SPF/DKIM/DMARC records             |
| Template rendering    | Test in Mailpit, check HTML escaping         |

## Advanced Configuration

### Custom SMTP Transporter

```typescript
import { createTransporter } from '@/infrastructure/email'

const customConfig = {
  host: 'smtp.custom.com',
  port: 2525,
  secure: false,
  auth: {
    user: 'custom-user',
    pass: 'custom-pass',
  },
  from: {
    email: 'noreply@custom.com',
    name: 'Custom App',
  },
}

const transporter = createTransporter(customConfig)

await transporter.sendMail({
  from: customConfig.from.email,
  to: 'user@example.com',
  subject: 'Test',
  text: 'Test',
})
```

### Email with Attachments

```typescript
import { sendEmailWithOptions } from '@/infrastructure/email'

await sendEmailWithOptions({
  from: '"Company" <noreply@example.com>',
  to: 'user@example.com',
  subject: 'Invoice Attached',
  html: '<h1>Your Invoice</h1>',
  text: 'Your invoice is attached.',
  attachments: [
    {
      filename: 'invoice.pdf',
      path: '/path/to/invoice.pdf',
    },
    {
      filename: 'logo.png',
      content: Buffer.from('...'),
      cid: 'logo',
    },
  ],
})
```

### HTML Email with Embedded Images

```typescript
await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  html: `
    <h1>Welcome!</h1>
    <img src="cid:logo" alt="Logo">
  `,
  attachments: [
    {
      filename: 'logo.png',
      path: '/path/to/logo.png',
      cid: 'logo',
    },
  ],
})
```

## Testing

### Unit Tests (Bun Test)

```typescript
// email-service.test.ts
import { describe, expect, test, mock } from 'bun:test'
import { Effect } from 'effect'
import { Email, EmailLive } from '@/infrastructure/email'

describe('EmailService', () => {
  test('sends email with default from', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      const messageId = yield* email.sendWithDefaultFrom({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      })
      return messageId
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))

    expect(result).toBeString()
  })
})
```

### E2E Tests (Playwright + Mailpit)

```typescript
// specs/api/auth/password-reset.spec.ts
import { test, expect } from '@playwright/test'

test('password reset sends email', async ({ page, request }) => {
  // Trigger password reset
  await page.goto('/forgot-password')
  await page.fill('input[type="email"]', 'user@example.com')
  await page.click('button[type="submit"]')

  // Wait for email
  await page.waitForTimeout(500)

  // Verify via Mailpit API
  const response = await request.get('http://localhost:8025/api/v1/messages')
  const data = await response.json()

  expect(data.messages).toHaveLength(1)
  expect(data.messages[0].Subject).toContain('Reset your password')
})
```

## References

- Nodemailer Documentation: https://nodemailer.com/
- SMTP Protocol: https://nodemailer.com/smtp/
- Gmail SMTP: https://nodemailer.com/usage/using-gmail/
- Mailpit (local testing): @docs/infrastructure/email/mailpit.md
- Better Auth Email Integration: @docs/infrastructure/framework/better-auth.md
- Effect Service Layer: @docs/infrastructure/framework/effect.md
