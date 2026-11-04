/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of signing: the `signature-pad`, inline or on a
 * flow's signing page, and the page every signing link that no longer works
 * shows. Part of {@link INTERPRETER_UI_STRINGS} through the components table;
 * kept apart so the whole vocabulary a signer reads sits in one place. English
 * is the default, French is built in, and an author renames any key under
 * `sovrium.<key>`.
 *
 * The words stay plain and factual: they say what happens and what to do
 * next, and never what a signature is worth in law.
 */
export const SIGNING_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- The pad: `{name}` signed on `{date}`, a day already in the page language. Like
  // every line a signer reads, the French says `tu`. ----
  'signaturePad.label': { en: 'Signature', fr: 'Signature' },
  'signaturePad.well': {
    en: 'Signing well: draw your signature',
    fr: 'Zone de signature : dessine ta signature',
  },
  'signaturePad.fullName': { en: 'Full name', fr: 'Nom complet' },
  'signaturePad.clear': { en: 'Clear', fr: 'Effacer' },
  'signaturePad.typeInstead': { en: 'Type your name instead', fr: 'Saisir mon nom plutôt' },
  'signaturePad.drawInstead': { en: 'Draw instead', fr: 'Dessiner plutôt' },
  'signaturePad.sign': { en: 'Sign', fr: 'Signer' },
  'signaturePad.signing': { en: 'Signing…', fr: 'Signature en cours…' },
  'signaturePad.saveFailed': {
    en: 'The signature could not be saved. Check the connection and sign again.',
    fr: 'La signature n’a pas pu être enregistrée. Vérifie la connexion et signe à nouveau.',
  },
  'signaturePad.signedBy': { en: 'Signed by {name} on {date}', fr: 'Signé par {name} le {date}' },
  'signaturePad.unknownSigner': { en: 'an unknown signer', fr: 'un signataire inconnu' },
  'signaturePad.unknownDate': { en: 'an unknown date', fr: 'une date inconnue' },

  // ---- The pad on a signing page: the document, consent, and declining ----
  'signaturePad.openDocument': { en: 'Open the document', fr: 'Ouvrir le document' },
  /** Beside the document link: its format and length. */
  'signaturePad.documentPages': { en: 'PDF, {count} pages', fr: 'PDF, {count} pages' },
  'signaturePad.documentPage': { en: 'PDF, 1 page', fr: 'PDF, 1 page' },
  /** Under the well: pressing Sign is the agreement, so the pad says so before it. */
  'signaturePad.consentNote': {
    en: 'By pressing Sign, you agree to the statement above.',
    fr: 'En appuyant sur Signer, tu acceptes la déclaration ci-dessus.',
  },
  'signaturePad.declineOpen': { en: 'Decline to sign', fr: 'Refuser de signer' },
  'signaturePad.declineReason': { en: 'Reason (optional)', fr: 'Motif (facultatif)' },
  'signaturePad.declineConfirm': { en: 'Decline', fr: 'Refuser' },
  'signaturePad.declining': { en: 'Declining…', fr: 'Refus en cours…' },
  'signaturePad.declineBack': { en: 'Back to signing', fr: 'Revenir à la signature' },
  'signaturePad.declined': {
    en: 'You declined to sign this document.',
    fr: 'Tu as refusé de signer ce document.',
  },

  // ---- The pad on a signing page whose flow asks for a code ----
  'signaturePad.verifyEmail': {
    en: 'Before you sign, confirm it is you with a code sent by email.',
    fr: 'Avant de signer, confirme que c’est bien toi avec un code reçu par e-mail.',
  },
  'signaturePad.verifySms': {
    en: 'Before you sign, confirm it is you with a code sent by text message.',
    fr: 'Avant de signer, confirme que c’est bien toi avec un code reçu par SMS.',
  },
  'signaturePad.sendCode': { en: 'Send a code', fr: 'Envoyer un code' },
  'signaturePad.sendingCode': { en: 'Sending…', fr: 'Envoi en cours…' },
  'signaturePad.codeLabel': { en: 'Code sent to {destination}', fr: 'Code envoyé à {destination}' },
  'signaturePad.resendCode': { en: 'Send a new code', fr: 'Renvoyer un code' },
  'signaturePad.resendIn': {
    en: 'New code available in {seconds} s',
    fr: 'Nouveau code possible dans {seconds} s',
  },

  // ---- The refusals a signer can act on, by contract code ----
  'signaturePad.error.CONSENT_REQUIRED': {
    en: 'Read the statement, then press Sign to agree to it.',
    fr: 'Lis la déclaration, puis appuie sur Signer pour l’accepter.',
  },
  'signaturePad.error.VERIFICATION_REQUIRED': {
    en: 'Enter the code sent to you before signing.',
    fr: 'Saisis le code qui t’a été envoyé avant de signer.',
  },
  'signaturePad.error.CODE_INVALID': {
    en: 'This code does not match. Check it and enter it again.',
    fr: 'Ce code ne correspond pas. Vérifie-le et saisis-le à nouveau.',
  },
  'signaturePad.error.CODE_EXPIRED': {
    en: 'This code has expired. Send a new code.',
    fr: 'Ce code a expiré. Renvoie un code.',
  },
  'signaturePad.error.TOO_MANY_CODE_ATTEMPTS': {
    en: 'Too many wrong codes. Send a new code to try again.',
    fr: 'Trop de codes erronés. Renvoie un code pour réessayer.',
  },
  'signaturePad.error.TOO_MANY_CODES_SENT': {
    en: 'Too many codes were sent for this link. Try again later.',
    fr: 'Trop de codes ont été envoyés pour ce lien. Réessaie plus tard.',
  },
  'signaturePad.error.RESEND_TOO_SOON': {
    en: 'A code was sent a moment ago. Wait before asking for a new one.',
    fr: 'Un code vient d’être envoyé. Patiente avant d’en demander un autre.',
  },
  'signaturePad.error.IMAGE_INVALID': {
    en: 'The drawing could not be read. Clear it and draw again, or type your name.',
    fr: 'Le dessin n’a pas pu être lu. Efface-le et dessine à nouveau, ou saisis ton nom.',
  },
  'signaturePad.error.STATEMENT_CHANGED': {
    en: 'The statement changed after this page opened. Reload the page and read it before signing.',
    fr: 'La déclaration a changé depuis l’ouverture de la page. Recharge la page et relis-la avant de signer.',
  },
  'signaturePad.error.NOT_YOUR_TURN': {
    en: 'Someone else has to sign first. You will get a new message when it is your turn.',
    fr: 'Quelqu’un d’autre doit signer avant toi. Tu recevras un nouveau message quand ce sera ton tour.',
  },
  /** The session ended while the page was open: the link was withdrawn, expired, or used. */
  'signaturePad.error.NOT_FOUND': {
    en: 'This signing link no longer works. Ask whoever sent it for a new one.',
    fr: 'Ce lien de signature ne fonctionne plus. Demande-en un nouveau à la personne qui te l’a envoyé.',
  },

  // ---- The page every signing link that no longer works shows: names nothing of the request ----
  'signingLink.invalidTitle': { en: 'This link no longer works', fr: 'Ce lien ne fonctionne plus' },
  'signingLink.invalidBody': {
    en: 'It may have expired, been used already, or been withdrawn. If you still need to sign, ask whoever sent it for a new link.',
    fr: 'Il a peut-être expiré, déjà servi ou été retiré. Si tu dois encore signer, demande un nouveau lien à la personne qui te l’a envoyé.',
  },
}
