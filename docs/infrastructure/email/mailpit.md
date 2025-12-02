# Mailpit - Local Email Testing Tool

## Overview

**Version**: Latest (Docker/binary)
**Purpose**: Local email testing server with web UI for development - catches all outgoing emails without delivering them

Mailpit is a small, fast email testing tool with a web UI designed specifically for development and testing. It acts as an SMTP server that catches all emails sent to it, displays them in a browser interface, and never delivers them to actual recipients.

## Why Mailpit for Sovrium

- **Local Testing**: No external dependencies, runs entirely on your machine
- **Fast**: Written in Go, minimal resource usage
- **Web UI**: Beautiful interface to view emails at http://localhost:8025
- **Complete Email Viewing**: HTML rendering, plaintext, headers, attachments
- **No Configuration**: Works out-of-box with existing nodemailer setup
- **Safe**: Emails never leave your local environment
- **Better than Ethereal**: No rate limits, no internet required, faster
- **Docker Ready**: Single-command setup via Docker
- **API Access**: REST API for automated testing

## Installation

### Option 1: Docker (Recommended)

```bash
# Run Mailpit container
docker run -d \
  --name=mailpit \
  -p 8025:8025 \
  -p 1025:1025 \
  --restart unless-stopped \
  axllent/mailpit

# View logs
docker logs -f mailpit

# Stop/Start
docker stop mailpit
docker start mailpit

# Remove
docker rm -f mailpit
```

### Option 2: Docker Compose

```yaml
# docker-compose.yml (or add to existing file)
version: '3.8'

services:
  mailpit:
    image: axllent/mailpit:latest
    container_name: sovrium-mailpit
    restart: unless-stopped
    ports:
      - '8025:8025' # Web UI
      - '1025:1025' # SMTP server
    environment:
      MP_MAX_MESSAGES: 5000 # Keep last 5000 emails
      MP_SMTP_AUTH_ACCEPT_ANY: 1 # Accept any username/password
      MP_SMTP_AUTH_ALLOW_INSECURE: 1 # Allow insecure auth
```

```bash
# Start Mailpit
docker-compose up -d mailpit

# View logs
docker-compose logs -f mailpit

# Stop
docker-compose down
```

### Option 3: Homebrew (macOS)

```bash
# Install
brew install mailpit

# Run in foreground
mailpit

# Run as background service
brew services start mailpit

# Stop service
brew services stop mailpit
```

### Option 4: Binary (Linux/Windows/macOS)

```bash
# Download from GitHub releases
# https://github.com/axllent/mailpit/releases

# Example for macOS
curl -LO https://github.com/axllent/mailpit/releases/latest/download/mailpit-darwin-amd64.tar.gz
tar -xzf mailpit-darwin-amd64.tar.gz
chmod +x mailpit
./mailpit
```

## Configuration

### Default Ports

| Port | Service     | URL                   |
| ---- | ----------- | --------------------- |
| 8025 | Web UI      | http://localhost:8025 |
| 1025 | SMTP Server | localhost:1025        |

### Environment Variables for Sovrium

When using Mailpit, configure these environment variables in `.env`:

```bash
# Mailpit SMTP Configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false  # Mailpit uses unencrypted SMTP

# No authentication needed (Mailpit accepts anything)
SMTP_USER=
SMTP_PASS=

# Default sender (optional)
SMTP_FROM=noreply@sovrium.local
SMTP_FROM_NAME=Sovrium (Dev)
```

### Integration with Nodemailer

The existing `src/infrastructure/email/nodemailer.ts` automatically uses Mailpit when environment variables are set:

```typescript
// nodemailer.ts automatically reads these env vars
export function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST // 'localhost'

  if (host) {
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10) // 1025
    return {
      host, // localhost
      port, // 1025
      secure: process.env.SMTP_SECURE === 'true' || port === 465, // false
      auth: {
        user: process.env.SMTP_USER ?? '', // empty
        pass: process.env.SMTP_PASS ?? '', // empty
      },
      from: {
        email: process.env.SMTP_FROM ?? 'noreply@sovrium.com',
        name: process.env.SMTP_FROM_NAME ?? 'Sovrium',
      },
    }
  }

  // Falls back to Ethereal if SMTP_HOST not set
  return {
    /* Ethereal config */
  }
}
```

## Usage

### 1. Start Mailpit

```bash
# Docker
docker start mailpit

# Docker Compose
docker-compose up -d mailpit

# Homebrew
brew services start mailpit

# Binary
./mailpit
```

### 2. Configure Environment

```bash
# .env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

### 3. Send Test Email

```typescript
// From any part of the app
import { sendEmail } from '@/infrastructure/email/email-service'

await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Hello from Sovrium!</h1>',
})
```

### 4. View in Web UI

Open http://localhost:8025 in your browser to see all captured emails.

## Web UI Features

### Email List View

- All captured emails displayed chronologically
- Subject, sender, recipients visible
- Search emails by subject, sender, content
- Filter by date range
- Tag emails (color-coded labels)
- Bulk delete

### Email Detail View

- **HTML Preview**: Rendered HTML email
- **Plain Text**: Text-only version
- **Source**: Raw email source
- **Headers**: SMTP headers (X-headers, MIME, etc.)
- **Attachments**: Download any attached files
- **MIME Parts**: View all MIME parts separately

### Additional Features

- **Real-time Updates**: New emails appear automatically
- **Responsive Design**: Works on mobile browsers
- **Dark Mode**: Toggle dark/light theme
- **Spam Check**: SpamAssassin integration (optional)
- **Keyboard Shortcuts**: Navigate emails quickly

## Better Auth Integration

Mailpit works seamlessly with Better Auth email callbacks:

### Password Reset Emails

```typescript
// src/infrastructure/auth/better-auth/auth.ts
import { sendEmail } from '@/infrastructure/email'
import { resetPasswordTemplate } from '@/infrastructure/email/templates'

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      const html = resetPasswordTemplate({ user, url, token })

      await sendEmail({
        to: user.email,
        subject: 'Reset Your Password',
        html,
      })

      // Email appears in Mailpit at http://localhost:8025
    },
  },
})
```

### Email Verification

```typescript
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      const html = verificationEmailTemplate({ user, url, token })

      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email',
        html,
      })

      // Email appears in Mailpit at http://localhost:8025
    },
  },
})
```

## Testing Emails

### Manual Testing

1. Trigger email action (signup, password reset, etc.)
2. Open http://localhost:8025
3. Verify email content, formatting, links
4. Test responsive design (HTML view)
5. Check headers (spam score, DKIM, etc.)

### Automated Testing (E2E)

Mailpit provides a REST API for automated testing:

```typescript
// specs/api/auth/password-reset.spec.ts
import { test, expect } from '@playwright/test'

test('password reset sends email', async ({ page, request }) => {
  // Trigger password reset
  await page.goto('/forgot-password')
  await page.fill('input[type="email"]', 'user@example.com')
  await page.click('button[type="submit"]')

  // Wait for email to be sent
  await page.waitForTimeout(500)

  // Check Mailpit API for email
  const response = await request.get('http://localhost:8025/api/v1/messages')
  const data = await response.json()

  expect(data.messages).toHaveLength(1)
  expect(data.messages[0].To[0].Address).toBe('user@example.com')
  expect(data.messages[0].Subject).toContain('Reset Your Password')

  // Get email content
  const messageId = data.messages[0].ID
  const email = await request.get(`http://localhost:8025/api/v1/message/${messageId}`)
  const emailData = await email.json()

  // Verify reset link exists
  expect(emailData.HTML).toContain('/reset-password?token=')
})
```

## API Reference

Mailpit provides a REST API at http://localhost:8025/api/v1/

### List Messages

```bash
GET /api/v1/messages
```

```typescript
const response = await fetch('http://localhost:8025/api/v1/messages')
const data = await response.json()
// { messages: [...], total: 5 }
```

### Get Single Message

```bash
GET /api/v1/message/{id}
```

```typescript
const response = await fetch(`http://localhost:8025/api/v1/message/${messageId}`)
const data = await response.json()
// { ID, From, To, Subject, HTML, Text, Headers, Attachments, ... }
```

### Delete Message

```bash
DELETE /api/v1/message/{id}
```

### Delete All Messages

```bash
DELETE /api/v1/messages
```

## Mailpit vs Ethereal

| Feature         | Mailpit       | Ethereal                |
| --------------- | ------------- | ----------------------- |
| **Speed**       | Instant       | 2-3 seconds delay       |
| **Internet**    | Not required  | Required                |
| **Rate Limits** | None          | Yes (free tier)         |
| **Web UI**      | Local (fast)  | Remote (slower)         |
| **API**         | Full REST API | Limited                 |
| **Setup**       | 1 command     | Account creation        |
| **Privacy**     | 100% local    | Emails on remote server |
| **Attachments** | Full support  | Full support            |
| **Cost**        | Free          | Free (limited)          |
| **Persistence** | Until restart | 24 hours                |

## Best Practices

1. **Use Mailpit for Local Development**: Faster and more reliable than Ethereal
2. **Keep Mailpit Running**: Start with Docker to auto-restart on reboot
3. **Clear Messages Regularly**: Prevent memory buildup (or set MP_MAX_MESSAGES)
4. **Test All Email Templates**: Use Mailpit to validate HTML rendering
5. **Check Spam Scores**: Enable SpamAssassin integration for production readiness
6. **Use API for E2E Tests**: Automate email verification in test suites
7. **Verify Links**: Always click email links to ensure correct URL generation
8. **Test Attachments**: Verify file attachments download correctly
9. **Monitor SMTP Logs**: Use `docker logs -f mailpit` to debug connection issues
10. **Use .env for Config**: Never hardcode SMTP settings in code

## Troubleshooting

| Issue                    | Solution                                     |
| ------------------------ | -------------------------------------------- |
| Port 1025 already in use | Stop other SMTP servers or change port       |
| Port 8025 already in use | Stop other web servers or change port        |
| Emails not appearing     | Check SMTP_HOST=localhost in .env            |
| Connection refused       | Ensure Mailpit is running (docker ps)        |
| Cannot access Web UI     | Check firewall, try 127.0.0.1:8025           |
| Slow email sending       | Use localhost instead of 127.0.0.1           |
| Auth errors              | Set SMTP_USER and SMTP_PASS to empty strings |
| SMTP timeout             | Increase timeout in nodemailer config        |

## Advanced Configuration

### Custom Ports

```bash
# Start Mailpit with custom ports
mailpit --smtp=2525 --listen=9025

# Update .env
SMTP_PORT=2525
# Access UI at http://localhost:9025
```

### Enable Authentication

```bash
# Docker
docker run -d \
  -p 8025:8025 -p 1025:1025 \
  -e MP_SMTP_AUTH_ACCEPT_ANY=0 \
  -e MP_SMTP_AUTH_FILE=/auth.txt \
  axllent/mailpit

# auth.txt format: username:password (bcrypt)
```

### TLS/SSL Support

```bash
# Enable STARTTLS
mailpit --smtp-tls-cert=/path/to/cert.pem --smtp-tls-key=/path/to/key.pem

# Update .env
SMTP_SECURE=true
```

### Message Retention

```bash
# Keep only last 1000 messages
docker run -d \
  -p 8025:8025 -p 1025:1025 \
  -e MP_MAX_MESSAGES=1000 \
  axllent/mailpit
```

## Development Workflow

### Typical Workflow

1. **Start Mailpit**: `docker-compose up -d mailpit`
2. **Set Environment**: Add SMTP_HOST=localhost to .env
3. **Develop Feature**: Implement email-sending code
4. **Test Locally**: Trigger email, check Mailpit UI
5. **Refine Template**: Edit HTML, resend, check rendering
6. **Verify Links**: Click links in email to test URLs
7. **Write E2E Test**: Automate verification via Mailpit API
8. **Commit**: Push changes with tested email integration

### Example Development Cycle

```bash
# 1. Start Mailpit
docker-compose up -d mailpit

# 2. Run app
bun run start

# 3. Trigger email (via app or API)
# Visit http://localhost:8025 to see email

# 4. Edit template if needed
# src/infrastructure/email/templates.ts

# 5. Resend email to verify changes

# 6. Write E2E test
# specs/api/auth/email-verification.spec.ts

# 7. Run tests
bun test:e2e
```

## Integration with CI/CD

Mailpit can be used in CI pipelines for E2E testing:

```yaml
# .github/workflows/test.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mailpit:
        image: axllent/mailpit:latest
        ports:
          - 1025:1025
          - 8025:8025

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run E2E tests
        run: bun test:e2e
        env:
          SMTP_HOST: localhost
          SMTP_PORT: 1025
          SMTP_SECURE: false
```

## When to Use Mailpit

**Use Mailpit for:**

- Local development and testing
- E2E test automation (Playwright, Cypress)
- Email template development and design
- Debugging email-sending issues
- Verifying email links and content
- Testing attachments locally
- CI/CD pipelines

**Use Ethereal for:**

- Quick throwaway tests without Docker
- Sharing emails with remote team members
- When Docker is not available
- Public demos (shareable links)

## References

- Mailpit GitHub: https://github.com/axllent/mailpit
- Mailpit Documentation: https://mailpit.axllent.org/
- Docker Hub: https://hub.docker.com/r/axllent/mailpit
- API Documentation: https://mailpit.axllent.org/docs/api-v1/
- Nodemailer Configuration: https://nodemailer.com/smtp/
