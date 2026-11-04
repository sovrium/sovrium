/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// French for `signatures.ts`, key for key, in the same order.

export default {
  'admin.signatures.heading': 'Signatures',
  'admin.signatures.blurb':
    'Chaque demande de signature envoyée par ton app : qui la signe et où elle en est. Tes automatisations envoient et retirent les demandes ; ici, tu les lis et tu télécharges leurs preuves.',
  'admin.signatures.search': 'Rechercher une demande',
  'admin.signatures.region': 'Demandes de signature',
  'admin.signatures.empty':
    'Aucune demande de signature pour l’instant. Une demande apparaît ici quand une automatisation l’envoie avec une étape signature/send.',
  'admin.signatures.noMatch': 'Aucune demande ne correspond à « {query} »',
  'admin.signatures.col.flow': 'Parcours',
  'admin.signatures.col.record': 'Enregistrement',
  'admin.signatures.col.status': 'Statut',
  'admin.signatures.col.signers': 'Signataires',
  'admin.signatures.col.sent': 'Envoyée',
  'admin.signatures.col.ended': 'Terminée',
  'admin.signatures.col.keepUntil': 'Preuves conservées jusqu’au',
  'admin.signatures.col.signer': 'Signataire',
  'admin.signatures.col.role': 'Rôle',
  'admin.signatures.col.signedAt': 'Signé',
  'admin.signatures.col.verifiedBy': 'Vérifié par',
  'admin.signatures.col.seq': 'N°',
  'admin.signatures.col.event': 'Événement',
  'admin.signatures.col.at': 'Quand',
  'admin.signatures.status.sent': 'Envoyée',
  'admin.signatures.status.inProgress': 'En cours',
  'admin.signatures.status.sealing': 'Scellement',
  'admin.signatures.status.completed': 'Terminée',
  'admin.signatures.status.declined': 'Refusée',
  'admin.signatures.status.cancelled': 'Annulée',
  'admin.signatures.status.expired': 'Expirée',
  'admin.signatures.signer.waiting': 'En attente',
  'admin.signatures.signer.sent': 'Lien envoyé',
  'admin.signatures.signer.signed': 'Signé',
  'admin.signatures.signer.declined': 'Refusé',
  'admin.signatures.event.sent': 'Demande envoyée',
  'admin.signatures.event.opened': 'Lien ouvert',
  'admin.signatures.event.challengeSent': 'Code envoyé',
  'admin.signatures.event.challengeVerified': 'Code confirmé',
  'admin.signatures.event.challengeFailed': 'Code erroné',
  'admin.signatures.event.signed': 'Signé',
  'admin.signatures.event.declined': 'Refusé',
  'admin.signatures.event.reminded': 'Relance envoyée',
  'admin.signatures.event.cancelled': 'Retirée',
  'admin.signatures.event.expired': 'Expirée',
  'admin.signatures.event.sealed': 'Scellée',
  'admin.signatures.event.completed': 'Terminée',
  'admin.signatures.event.delivered': 'Copie signée envoyée',
  'admin.signatures.event.erased': 'Signataire effacé',
  'admin.signatures.detail.blurb':
    'Une demande de signature, en lecture seule : son document, ses signataires et chaque événement de son journal de preuves.',
  'admin.signatures.detail.expires': 'Les liens expirent',
  'admin.signatures.detail.document': 'Empreinte du document (SHA-256)',
  'admin.signatures.detail.sealed': 'Scellé',
  'admin.signatures.detail.timestamped': 'Horodaté',
  'admin.signatures.detail.signers': 'Signataires',
  'admin.signatures.detail.signersBlurb':
    'Qui signe, dans l’ordre, et comment chacun a été vérifié.',
  'admin.signatures.detail.noSigners': 'Cette demande n’a aucun signataire.',
  'admin.signatures.detail.timeline': 'Journal de preuves',
  'admin.signatures.detail.timelineBlurb':
    'Chaque événement de la demande, dans l’ordre. Chacun s’engage sur le précédent : une ligne modifiée casse le journal.',
  'admin.signatures.detail.noEvents': 'Aucun événement enregistré pour l’instant.',
  'admin.signatures.detail.export': 'Télécharger les preuves',
  'admin.signatures.detail.exportHint':
    'Un fichier JSON avec le document figé, le document signé, le fichier de preuve et le journal. Vérifie-le avec sovrium signature verify.',

  // ── Organisation (`/organisation`) ──────────────────────────────────────
  //
  // Le vocabulaire de sécurité en français, fixé une fois ici pour les cinq
  // vues : « droit » pour *grant*, « source de droits » pour *grant source*,
  // « barreau ouvert » pour *open rung* (le `*` de la config), « constat » pour
  // *finding*. Un terme par notion, comme en anglais.
} as const
