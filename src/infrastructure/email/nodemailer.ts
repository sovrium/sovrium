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

export function getEmailConfig(): EmailConfig {
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

function getLazyConfig(): EmailConfig {
  if (!_config) {
    _config = getEmailConfig()
  }
  return _config
}

export function getTransporter(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  if (!_transporter) {
    _transporter = createTransporter(getLazyConfig())
  }
  return _transporter
}

export const transporter = new Proxy({} as nodemailer.Transporter<SMTPTransport.SentMessageInfo>, {
  get(_target, prop, receiver) {
    return Reflect.get(getTransporter(), prop, receiver)
  },
})

export function getDefaultFrom(): string {
  const { email, name } = getLazyConfig().from
  return `"${name}" <${email}>`
}

export type SendMailOptions = Mail.Options

export async function verifyConnection(): Promise<boolean> {
  return getTransporter().verify()
}
