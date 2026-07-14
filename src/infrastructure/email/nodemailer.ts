/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import nodemailer from 'nodemailer'
import { getEmailConfigFromEffect } from './email-config'
import type Mail from 'nodemailer/lib/mailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

export interface EmailConfig {
  readonly host: string
  readonly port: number
  readonly secure: boolean
  readonly auth: {
    readonly user: string
    readonly pass: string
  }
  readonly from: {
    readonly email: string
    readonly name: string
  }
}

export function getEmailConfig(): EmailConfig | undefined {
  return getEmailConfigFromEffect().config
}

const DEFAULT_SMTP_TIMEOUT_MS = 10_000

function resolveSmtpTimeout(envVar: string): number {
  const raw = process.env[envVar]
  if (raw === undefined) return DEFAULT_SMTP_TIMEOUT_MS
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SMTP_TIMEOUT_MS
}

export function createTransporter(
  config: Readonly<EmailConfig>
): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    connectionTimeout: resolveSmtpTimeout('SMTP_CONNECTION_TIMEOUT'),
    greetingTimeout: resolveSmtpTimeout('SMTP_GREETING_TIMEOUT'),
    socketTimeout: resolveSmtpTimeout('SMTP_SOCKET_TIMEOUT'),
  })
}

let _config: EmailConfig | undefined
let _transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | undefined

function getLazyConfig(): EmailConfig | undefined {
  if (!_config) {
    _config = getEmailConfig()
  }
  return _config
}

export function getTransporter():
  nodemailer.Transporter<SMTPTransport.SentMessageInfo> | undefined {
  const config = getLazyConfig()
  if (!config) return undefined
  if (!_transporter) {
    _transporter = createTransporter(config)
  }
  return _transporter
}

export function getDefaultFrom(): string {
  const email = process.env.SMTP_FROM ?? 'noreply@sovrium.com'
  const name = process.env.SMTP_FROM_NAME ?? 'Sovrium'
  return `"${name}" <${email}>`
}

export type SendMailOptions = Mail.Options

export async function verifyConnection(): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) return false
  return transporter.verify()
}
