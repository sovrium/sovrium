/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of the default auth emails — those sent when the app
 * declares no `auth.emailTemplates` entry for them. Read in the recipient's
 * stored language, else the app's default language, else English; `{app}` is
 * the app's name. Part of {@link INTERPRETER_UI_STRINGS}, which spreads this
 * table in; kept apart only so neither file outgrows its ceiling. An author
 * renames any key under `sovrium.<key>`.
 */
export const EMAIL_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'email.greeting': { en: 'Hi {name},', fr: 'Bonjour {name},' },
  'email.greetingAnonymous': { en: 'Hi,', fr: 'Bonjour,' },
  'email.linkFallback': {
    en: "If the button doesn't work, copy and paste this link into your browser:",
    fr: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
  },
  'email.linkExpires': {
    en: 'This link will expire in {expiry}.',
    fr: 'Ce lien expire dans {expiry}.',
  },
  'email.expiry.minutes': { en: '{count} minutes', fr: '{count} minutes' },
  'email.expiry.hour1': { en: '1 hour', fr: '1 heure' },
  'email.expiry.hours24': { en: '24 hours', fr: '24 heures' },
  'email.requestedNotice': {
    en: "This email was sent by {app}. If you didn't request this, please ignore this email.",
    fr: 'Cet e-mail a été envoyé par {app}. Si vous n’êtes pas à l’origine de cette demande, ignorez-le.',
  },
  'email.resetPassword.subject': {
    en: 'Reset your {app} password',
    fr: 'Réinitialisez votre mot de passe {app}',
  },
  'email.resetPassword.intro': {
    en: 'We received a request to reset your password for your {app} account.',
    fr: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte {app}.',
  },
  'email.resetPassword.cta': {
    en: 'Click the button below to reset your password:',
    fr: 'Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :',
  },
  'email.resetPassword.button': { en: 'Reset Password', fr: 'Réinitialiser le mot de passe' },
  'email.resetPassword.textCta': {
    en: 'Reset your password by visiting this link:',
    fr: 'Réinitialisez votre mot de passe en ouvrant ce lien :',
  },
  'email.resetPassword.ignore': {
    en: "If you didn't request a password reset, you can safely ignore this email.",
    fr: 'Si vous n’avez pas demandé de réinitialisation, ignorez cet e-mail.',
  },
  'email.verification.subject': {
    en: 'Verify your {app} email address',
    fr: 'Confirmez votre adresse e-mail {app}',
  },
  'email.verification.intro': {
    en: 'Welcome to {app}! Please verify your email address to complete your registration.',
    fr: 'Bienvenue sur {app} ! Confirmez votre adresse e-mail pour terminer votre inscription.',
  },
  'email.verification.cta': {
    en: 'Click the button below to verify your email:',
    fr: 'Cliquez sur le bouton ci-dessous pour confirmer votre adresse :',
  },
  'email.verification.button': { en: 'Verify Email', fr: 'Confirmer l’adresse' },
  'email.verification.textCta': {
    en: 'Verify your email by visiting this link:',
    fr: 'Confirmez votre adresse en ouvrant ce lien :',
  },
  'email.verification.ignore': {
    en: "If you didn't create an account with {app}, you can safely ignore this email.",
    fr: 'Si vous n’avez pas créé de compte sur {app}, ignorez cet e-mail.',
  },
  /**
   * The two emails of an email-address change: the confirmation sent to the
   * CURRENT address first, then the verification of the new one.
   */
  'email.changeEmail.confirm.subject': {
    en: 'Confirm the change of your {app} email address',
    fr: 'Confirmez le changement de votre adresse e-mail {app}',
  },
  'email.changeEmail.confirm.intro': {
    en: 'Someone asked to move your {app} account to the address {newEmail}.',
    fr: 'Quelqu’un a demandé à déplacer votre compte {app} vers l’adresse {newEmail}.',
  },
  'email.changeEmail.confirm.cta': {
    en: 'If it was you, confirm the change with the button below. The new address then receives a message to verify it.',
    fr: 'Si c’est vous, confirmez le changement avec le bouton ci-dessous. La nouvelle adresse recevra ensuite un message pour la vérifier.',
  },
  'email.changeEmail.confirm.button': { en: 'Confirm the change', fr: 'Confirmer le changement' },
  'email.changeEmail.confirm.textCta': {
    en: 'If it was you, confirm the change by visiting this link:',
    fr: 'Si c’est vous, confirmez le changement en ouvrant ce lien :',
  },
  'email.changeEmail.confirm.ignore': {
    en: 'If it was not you, ignore this email and your address stays as it is. Then change your password: someone is using your account.',
    fr: 'Si ce n’est pas vous, ignorez cet e-mail et votre adresse restera la même. Changez ensuite votre mot de passe : quelqu’un utilise votre compte.',
  },
  'email.changeEmail.verify.subject': {
    en: 'Verify your new {app} email address',
    fr: 'Vérifiez votre nouvelle adresse e-mail {app}',
  },
  'email.changeEmail.verify.intro': {
    en: 'This address was given as the new email address of a {app} account.',
    fr: 'Cette adresse a été indiquée comme nouvelle adresse e-mail d’un compte {app}.',
  },
  'email.changeEmail.verify.cta': {
    en: 'Click the button below to verify it and finish the change:',
    fr: 'Cliquez sur le bouton ci-dessous pour la vérifier et terminer le changement :',
  },
  'email.changeEmail.verify.button': {
    en: 'Verify the new address',
    fr: 'Vérifier la nouvelle adresse',
  },
  'email.changeEmail.verify.textCta': {
    en: 'Verify it and finish the change by visiting this link:',
    fr: 'Vérifiez-la et terminez le changement en ouvrant ce lien :',
  },
  'email.changeEmail.verify.ignore': {
    en: 'If you did not ask for this change, ignore this email: no {app} account will use this address.',
    fr: 'Si vous n’avez pas demandé ce changement, ignorez cet e-mail : aucun compte {app} n’utilisera cette adresse.',
  },
  'email.magicLink.subject': { en: 'Sign in to {app}', fr: 'Connexion à {app}' },
  'email.magicLink.body': {
    en: 'Click here to sign in to {app}:',
    fr: 'Cliquez ici pour vous connecter à {app} :',
  },
  'email.magicLink.button': { en: 'Sign In', fr: 'Se connecter' },
  'email.invitation.subject': {
    en: 'You are invited to join {app}',
    fr: 'Invitation à rejoindre {app}',
  },
  'email.invitation.invited': {
    en: '{inviter} invited you to join {app}.',
    fr: '{inviter} vous invite à rejoindre {app}.',
  },
  /** The HTML part's call to action; `{link}` is the link, drawn around `email.invitation.here`. */
  'email.invitation.htmlCta': {
    en: 'Click {link} to set your password and accept the invitation.',
    fr: 'Choisissez votre mot de passe et {link}.',
  },
  'email.invitation.here': { en: 'here', fr: 'acceptez l’invitation' },
  'email.invitation.textCta': {
    en: 'Click the link below to set your password and accept the invitation:',
    fr: 'Ouvrez le lien ci-dessous pour choisir votre mot de passe et accepter l’invitation :',
  },
  'email.invitation.singleUse': {
    en: 'This link is single-use.',
    fr: 'Ce lien ne fonctionne qu’une fois.',
  },
  /** The notice sent when wrong codes lock an account's second sign-in step. */
  'email.twoFactorLocked.subject': {
    en: 'Your two-step sign-in to {app} is paused',
    fr: 'Votre connexion en deux étapes à {app} est suspendue',
  },
  'email.twoFactorLocked.paused': {
    en: 'Too many wrong codes were entered at the second step of signing in to your {app} account, so that step is paused for {duration}.',
    fr: 'Trop de codes erronés ont été saisis à la deuxième étape de connexion à votre compte {app} : cette étape est suspendue pendant {duration}.',
  },
  'email.twoFactorLocked.after': {
    en: 'Once the pause is over, you can sign in again with the code from your authenticator app. To get back in sooner, ask an administrator of {app} to clear the pause.',
    fr: 'Une fois la suspension terminée, vous pourrez vous reconnecter avec le code de votre application d’authentification. Pour revenir plus tôt, demandez à un administrateur de {app} de lever la suspension.',
  },
  'email.twoFactorLocked.notYou': {
    en: 'If these attempts were not yours, someone may know your password: change it as soon as you are signed in.',
    fr: 'Si ces tentatives ne viennent pas de vous, quelqu’un connaît peut-être votre mot de passe : changez-le dès que vous serez connecté.',
  },
  'email.twoFactorLocked.footer': {
    en: 'This email was sent by {app} after failed sign-in attempts on your account.',
    fr: 'Cet e-mail a été envoyé par {app} après des tentatives de connexion échouées sur votre compte.',
  },
  /** The notice sent when an API key or a passkey is added to an account. */
  'email.credentialAdded.apiKey.subject': {
    en: 'A new API key was added to your {app} account',
    fr: 'Une nouvelle clé d’API a été ajoutée à votre compte {app}',
  },
  'email.credentialAdded.apiKey.added': {
    en: 'An API key named “{name}” was just added to your {app} account. Whoever holds it can read and change your {app} data on your behalf.',
    fr: 'Une clé d’API nommée « {name} » vient d’être ajoutée à votre compte {app}. Quiconque la détient peut lire et modifier vos données {app} en votre nom.',
  },
  'email.credentialAdded.apiKey.addedUnnamed': {
    en: 'An API key was just added to your {app} account. Whoever holds it can read and change your {app} data on your behalf.',
    fr: 'Une clé d’API vient d’être ajoutée à votre compte {app}. Quiconque la détient peut lire et modifier vos données {app} en votre nom.',
  },
  'email.credentialAdded.apiKey.notYou': {
    en: 'If you did not add it, revoke it from your account settings and change your password.',
    fr: 'Si vous ne l’avez pas ajoutée, révoquez-la depuis les paramètres de votre compte et changez votre mot de passe.',
  },
  'email.credentialAdded.passkey.subject': {
    en: 'A new passkey was added to your {app} account',
    fr: 'Une nouvelle clé d’accès a été ajoutée à votre compte {app}',
  },
  'email.credentialAdded.passkey.added': {
    en: 'A passkey named “{name}” was just added to your {app} account. It can now be used to sign in.',
    fr: 'Une clé d’accès nommée « {name} » vient d’être ajoutée à votre compte {app}. Elle permet désormais de se connecter.',
  },
  'email.credentialAdded.passkey.addedUnnamed': {
    en: 'A passkey was just added to your {app} account. It can now be used to sign in.',
    fr: 'Une clé d’accès vient d’être ajoutée à votre compte {app}. Elle permet désormais de se connecter.',
  },
  'email.credentialAdded.passkey.notYou': {
    en: 'If you did not add it, remove it from your account settings and change your password.',
    fr: 'Si vous ne l’avez pas ajoutée, supprimez-la depuis les paramètres de votre compte et changez votre mot de passe.',
  },
  'email.credentialAdded.footer': {
    en: 'This email was sent by {app} because a new way into your account was added.',
    fr: 'Cet e-mail a été envoyé par {app} car un nouvel accès à votre compte a été ajouté.',
  },
}
