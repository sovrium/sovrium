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

export function createTransporter(
  config: Readonly<EmailConfig>
): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
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
  | nodemailer.Transporter<SMTPTransport.SentMessageInfo>
  | undefined {
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
