/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import nodemailer from 'nodemailer'

// Create a test account or replace with real credentials.
export const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'maddison53@ethereal.email',
    pass: 'jn7jnAPss4f63QBp6D',
  },
})
