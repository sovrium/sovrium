/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's French catalogue, at exact key parity with `chrome.ts`,
// `console.ts`, `data.ts` and `developers.ts`, in that order.
//
// ─── ONE FILE, WHERE ENGLISH IS FOUR ───────────────────────────────────────
//
// The English table is split by area because several migrations append to it at
// once, and one shared object is a merge conflict per commit. French has the
// opposite problem: it is authored in one pass by one hand, and its only real
// failure mode is falling out of PARITY with English. Keeping it in one file,
// in the same section order, makes a missing key visible by reading down the
// two side by side. `design-system.ts` is deliberately NOT mirrored here — that
// file is being authored concurrently, and translating a moving target is how a
// catalogue acquires a stale half.
//
// ─── IT IS WIRED, AND THE SERVER NOW COMPOSES IT (re-measured 2026-09-19) ───
//
// Founder decision of 2026-09-18: the operator console ships French. The choice
// is a row on `/profile` — a `select` posting `{ language }` to
// `POST /api/auth/update-user` — and NOT the sidebar `language-switcher`, which
// was removed on 2026-09-19 by a second founder decision.
//
// The switch of medium is the whole story, and it retires what this block used
// to say. The old note recorded that a mounted request carried no locale, so the
// SERVER always rendered `en-US` and French was a client-side repaint that
// reached `content` strings only — leaving the sidebar navigation, every grid
// caption and every landmark name in English. That limit is GONE: the signed-in
// operator's saved language outranks the `sovrium_language` cookie and the
// console is composed in it server-side. Measured on `/_admin/profile` with the
// account set to `fr` and again to `fr-FR`: `<html lang="fr-FR">` and the
// breadcrumb reads `Mon profil`, sidebar group captions included.
//
// Two consequences worth keeping:
//
//   1. ASSERT THROUGH THE SERVED BYTES, NEVER THE HYDRATED DOM. Every keyed
//      text node still ships `data-translations` carrying EVERY locale, so
//      `html.includes('Bienvenue')` is true of an English render too. Read the
//      first element of a tag out of a `page.request.get(...)` response.
//   2. IT COSTS +5-6% ON EVERY PAGE. Measured over eight pages: `/` +758 B,
//      `/env` +1,048 B, `/footprint` +2,423 B, 154 KB → 164 KB — one repeat of
//      each string per declared language. That payload is now the price of a
//      feature that works rather than dead weight.
//
// Two things that were feared and did NOT happen, recorded so nobody re-argues
// them: `<html lang>` is byte-identical with and without the table on an ENGLISH
// server render (checked on four pages), and `hreflang` links are NOT emitted.
//
// `bun run app:admin` still serves the console standalone, where the ordinary
// `/{lang}/` routing applies and `http://localhost:5005/fr/` renders the whole
// console in French. It remains the cheapest way to review a translation
// without signing in.
//
// The catalogue is authored NOW rather than after the seam because the cheap
// moment to name a string is while the page it belongs to is being written.
// Retrofitting 250 translations onto a finished console means reading all 28
// pages again.
//
// ─── VOICE ─────────────────────────────────────────────────────────────────
//
// `tu`, the house rule (`apps/website/config/design.ts` → `voice.pronoun`), of
// which only the Partner app has an exception and for a client-services reason
// the console does not share.
//
// The English carries a deliberate split of person that the French keeps: the
// ACCOUNT cluster speaks in the first person, because those pages are about the
// reader's own record ("Mon profil", "Mes données", "Mon identité"), while
// guidance speaks in the second ("ton app", "tes tables"). Collapsing the two
// would make "Export or erase my data" read as an instruction from the console
// rather than as the reader's own action.
//
// [internal ref] D4 and BRAND §6 hold verbatim: state, do not sell; say what happened,
// not how you feel about it; name the next action, and only when there is one.
// No exclamation mark anywhere.
//
// ─── TYPOGRAPHY: THE NO-BREAK SPACES ARE DELIBERATE ────────────────────────
//
// French sets a space before `:` `;` `?` `!` and inside `« »`. Those are U+00A0
// (no-break space), so the punctuation cannot wrap to the next line. They are
// invisible in a diff and easy to mistake for a stray character — they are not.
// Do not "clean" them, and do not replace them with an ordinary space: a French
// operator reads `Erreur: …` as machine translation.

export default {
  // ═══ chrome.ts ═════════════════════════════════════════════════════════

  // `admin.shell.navLoading` is GONE from the English table — the placeholder
  // line it named was deleted when the sidebar stopped rendering one. It is
  // dropped here too rather than kept "in case": a French key with no English
  // sibling is a string nothing can ever resolve, and it is exactly what makes
  // a parity check report a difference that is not one.
  'admin.shell.openMenu': 'Ouvrir le menu',
  'admin.shell.openSite': 'Ouvrir le site dans un nouvel onglet',
  'admin.shell.search': 'Rechercher',
  'admin.shell.searchPlaceholder': 'Rechercher…',
  // The operator menu. `account` names the trigger, `myAccount` the row inside
  // it — "Mon compte" on both would make the menu say its own name twice.
  'admin.shell.account': 'Compte',
  'admin.shell.myAccount': 'Mon compte',
  'admin.shell.giveFeedback': 'Donner un avis',
  'admin.shell.reportBug': 'Signaler un bug',
  'admin.shell.signOut': 'Se déconnecter',

  // « Design » et « Overview » — le premier reste, le second non. Design est
  // le nom courant de la discipline en français et celui que porte la section ;
  // Overview a « Vue d’ensemble », qui dit la même chose sans emprunt.
  'admin.nav.welcome': 'Bienvenue',
  'admin.nav.group.system': 'Système',
  'admin.nav.group.application': 'Application',
  'admin.nav.group.developers': 'Développeurs',
  'admin.nav.landmark.data': 'Données',
  'admin.nav.design': 'Design',
  'admin.nav.design.overview': 'Vue d’ensemble',
  'admin.nav.design.foundations': 'Fondations',
  'admin.nav.design.uiKit': 'Kit d’interface',
  'admin.nav.design.components': 'Composants',
  'admin.nav.design.brand': 'Marque',
  'admin.nav.design.voice': 'Voix',

  'admin.crumb.profile': 'Mon profil',
  'admin.crumb.gdpr': 'Mes données',
  'admin.crumb.apiKeys': 'Clés API',
  'admin.crumb.env': 'Environnement',
  'admin.crumb.api': 'API',
  'admin.crumb.mcp': 'MCP',
  'admin.crumb.changelog': 'Journal des versions',
  'admin.crumb.tables': 'Enregistrements',
  'admin.crumb.buckets': 'Fichiers',
  'admin.crumb.agents': 'Conversations',
  'admin.crumb.forms': 'Réponses',
  'admin.crumb.connections': 'Connexions',
  'admin.crumb.organisation': 'Organisation',
  'admin.crumb.users': 'Utilisateurs',
  'admin.crumb.invitations': 'Invitations',
  'admin.crumb.pages': 'Analytique',
  'admin.crumb.automations': 'Exécutions',
  'admin.crumb.links': 'Liens',
  'admin.crumb.footprint': 'Empreinte',
  'admin.crumb.decisions': 'Décisions',

  // The "Sovrium — " stem is untranslated on purpose: it names whose surface
  // this is, and a product name is not a word to localise.
  'admin.meta.welcome': 'Sovrium — Bienvenue',
  'admin.meta.profile': 'Sovrium — Mon profil',
  'admin.meta.gdpr': 'Sovrium — Mes données',
  'admin.meta.apiKeys': 'Sovrium — Clés API',
  'admin.meta.env': 'Sovrium — Environnement',
  'admin.meta.api': 'Sovrium — API',
  'admin.meta.mcp': 'Sovrium — MCP',
  'admin.meta.changelog': 'Sovrium — Journal des versions',
  'admin.meta.release': 'Sovrium — Journal des versions · Version',
  'admin.meta.tables': 'Sovrium — Données · Enregistrements',
  'admin.meta.buckets': 'Sovrium — Données · Fichiers',
  'admin.meta.agents': 'Sovrium — Données · Conversations',
  'admin.meta.forms': 'Sovrium — Données · Réponses',
  'admin.meta.connections': 'Sovrium — Données · Connexions',
  'admin.meta.organisation': 'Sovrium — Organisation',
  'admin.meta.users': 'Sovrium — Données · Utilisateurs',
  'admin.meta.invitations': 'Sovrium — Données · Invitations',
  'admin.meta.userAccount': 'Sovrium — Données · Compte',
  'admin.meta.pages': 'Sovrium — Données · Analytique',
  'admin.meta.automations': 'Sovrium — Données · Exécutions',
  'admin.meta.links': 'Sovrium — Données · Liens',
  'admin.meta.footprint': 'Sovrium — Empreinte',
  'admin.meta.decisions': 'Sovrium — Décisions',
  'admin.meta.decision': 'Sovrium — Décision',
  'admin.meta.login': 'Sovrium — Connexion',
  'admin.meta.forgotPassword': 'Sovrium — Mot de passe oublié',
  'admin.meta.resetPassword': 'Sovrium — Nouveau mot de passe',

  // ═══ console.ts ════════════════════════════════════════════════════════

  'admin.field.email': 'Adresse e-mail',
  'admin.field.password': 'Mot de passe',
  'admin.field.displayName': 'Nom affiché',
  'admin.field.newPassword': 'Nouveau mot de passe',
  'admin.field.newEmail': 'Nouvelle adresse e-mail',
  'admin.field.currentPassword': 'Mot de passe actuel',

  // Segment optionnel : les crochets ne survivent que si le `$session.` qu’ils
  // contiennent se résout. Avec un nom, « Bienvenue, Ada Lovelace » ; sans nom,
  // et pour une visite anonyme, « Bienvenue » tout court — la virgule s’en va
  // avec le nom auquel elle appartient.
  'admin.welcome.heading': 'Bienvenue[, $session.name]',
  'admin.welcome.heroRegion': 'Demander ou chercher',
  'admin.welcome.noAi': 'Aucun fournisseur d’IA configuré — cherche dans l’app à la place.',
  // Le déclencheur de la palette côté héros, nommé À PART de celui de la barre
  // latérale : Bienvenue est la seule surface où les deux sont à l’écran, et
  // ils portaient le même nom. La barre latérale garde le verbe seul — c’est
  // l’affordance permanente de la console — et le héros nomme sa cible, dans
  // les mots de la légende juste en dessous.
  'admin.welcome.searchHero': 'Rechercher dans l’app',

  // Les destinations reprennent mot pour mot le vocabulaire du fil d’Ariane :
  // une exécution s’appelle « Exécutions » ici comme ailleurs, sinon
  // l’opérateur·ice a deux noms pour une seule console.
  'admin.welcome.pulse.region': 'Ce qui demande ton attention',
  'admin.welcome.pulse.heading': 'Depuis le démarrage de cette instance',
  'admin.welcome.pulse.failedRuns': 'exécutions en échec',
  'admin.welcome.pulse.failedRuns.where': 'Exécutions →',
  'admin.welcome.pulse.variablesUnset': 'variables requises non définies',
  'admin.welcome.pulse.variablesUnset.where': 'Environnement →',
  'admin.welcome.pulse.tokensExpired': 'jetons expirés',
  'admin.welcome.pulse.tokensExpired.where': 'Connexions →',
  'admin.welcome.pulse.invitationsPending': 'invitations en attente',
  'admin.welcome.pulse.invitationsPending.where': 'Utilisateurs →',
  'admin.welcome.pulse.recentSubmissions': 'nouvelles réponses',
  'admin.welcome.pulse.recentSubmissions.where': 'Réponses →',
  'admin.welcome.pulse.automationsPaused': 'automatisations en pause',
  'admin.welcome.pulse.automationsPaused.where': 'Exécutions →',

  'admin.welcome.counts.region': 'Ce que cette app déclare',
  'admin.welcome.counts.heading': 'Ce que cette app déclare',

  'admin.profile.identity.region': 'Ton compte',
  'admin.profile.rows.region': 'Réglages du compte',

  'admin.profile.picture.label': 'Photo',
  'admin.profile.picture.hint': 'PNG, JPEG ou WebP. 5 Mo maximum.',
  'admin.profile.picture.upload': 'Changer',
  'admin.profile.picture.remove': 'Retirer',
  'admin.profile.picture.removeConfirm.title': 'Retirer ta photo ?',
  'admin.profile.picture.removeConfirm.message':
    'La console affichera tes initiales à la place. Tu peux en déposer une nouvelle à tout moment.',
  'admin.profile.picture.removeConfirm.confirm': 'Retirer',
  'admin.profile.picture.removeConfirm.cancel': 'La garder',
  'admin.profile.picture.uploaded': 'Photo mise à jour.',
  'admin.profile.picture.uploadFailed':
    'Ce fichier a été refusé. Utilise un PNG, un JPEG ou un WebP de moins de 5 Mo.',
  'admin.profile.picture.removed': 'Photo retirée.',
  'admin.profile.picture.removeFailed': 'Impossible de retirer ta photo.',

  'admin.profile.displayName.hint': 'Affiché à côté de ton activité dans la console.',
  'admin.profile.displayName.formRegion': 'Changer ton nom affiché',
  'admin.profile.displayName.submit': 'Enregistrer',
  'admin.profile.displayName.saved': 'Nom enregistré.',
  'admin.profile.displayName.failed': 'Impossible d’enregistrer ton nom.',

  'admin.profile.email.hint':
    'Ne change qu’après que tu as suivi le lien de vérification envoyé à la nouvelle adresse.',
  'admin.profile.email.formRegion': 'Changer ton adresse e-mail',
  'admin.profile.email.submit': 'Envoyer le lien',
  'admin.profile.email.sent': 'Lien de vérification envoyé.',
  'admin.profile.email.sentDetail':
    'Lien de vérification envoyé. Ton adresse change une fois que tu l’as suivi.',
  'admin.profile.email.failed': 'Impossible d’envoyer le lien.',

  'admin.profile.password.formRegion': 'Changer ton mot de passe',
  'admin.profile.password.submit': 'Changer',
  'admin.profile.password.saved': 'Mot de passe changé.',
  'admin.profile.password.failed':
    'Impossible de changer ton mot de passe — vérifie ton mot de passe actuel.',

  'admin.profile.language.label': 'Langue',
  'admin.profile.language.hint': 'Suit ton compte sur tous les navigateurs où tu te connectes.',
  'admin.profile.language.formRegion': 'Changer la langue de la console',
  'admin.profile.language.submit': 'Enregistrer',
  'admin.profile.language.saved': 'Langue enregistrée.',
  'admin.profile.language.savedDetail':
    'Langue enregistrée. La console bascule à ta prochaine page.',
  'admin.profile.language.failed': 'Impossible d’enregistrer ta langue.',

  'admin.profile.data.label': 'Tes données',
  'admin.profile.data.hint':
    'Exporte tout ce que cette instance détient sur toi, ou efface ton compte.',
  'admin.profile.gdprLink': 'Ouvrir Mes données',

  'admin.gdpr.heading': 'Mes données (RGPD)',
  'admin.gdpr.blurb':
    'Ce que cette instance détient sur toi, et comment le récupérer ou l’effacer.',
  'admin.gdpr.identity.heading': 'Mon identité',
  'admin.gdpr.export.heading': 'Exporter mes données',
  'admin.gdpr.export.submit': 'Générer l’export',
  'admin.gdpr.erase.heading': 'Effacer mon compte',
  'admin.gdpr.erase.submit': 'Demander l’effacement',
  'admin.gdpr.erase.confirm.title': 'Confirmer l’effacement',
  'admin.gdpr.erase.confirm.message':
    'Cette action est définitive et irréversible. Saisis ton adresse e-mail pour confirmer l’effacement de ton compte.',
  'admin.gdpr.erase.confirm.input': 'Saisis ton adresse e-mail',
  'admin.gdpr.erase.confirm.affirm': 'Effacer',
  'admin.gdpr.erase.confirm.dismiss': 'Annuler',
  'admin.gdpr.pending.region': 'Demandes en cours',
  'admin.gdpr.pending.account': 'Compte',
  'admin.gdpr.pending.due': 'Échéance',
  'admin.gdpr.pending.actions': 'Actions',
  'admin.gdpr.pending.empty': 'Aucune demande d’effacement en cours.',
  'admin.gdpr.pending.cancel': 'Annuler',
  'admin.gdpr.pending.confirm.title': 'Confirmer l’annulation',
  'admin.gdpr.pending.confirm.message':
    'Annuler ta demande d’effacement de compte ? Ton compte ne sera pas supprimé.',
  'admin.gdpr.pending.confirm.affirm': 'Confirmer l’annulation',
  'admin.gdpr.pending.confirm.dismiss': 'Retour',
  'admin.gdpr.account.label': 'Ton compte',
  'admin.gdpr.account.hint': 'Change ton nom, ton e-mail, ton mot de passe, ta photo ou ta langue.',
  'admin.gdpr.profileLink': 'Ouvrir Mon profil',

  'admin.apiKeys.heading': 'Clés API',
  'admin.apiKeys.region': 'Tes clés API',
  'admin.apiKeys.loading': 'Chargement de tes clés API…',

  'admin.env.heading': 'Environnement',
  'admin.env.blurb':
    'Les variables que cette app déclare, et si cette instance a résolu chacune d’elles. Les valeurs ne sont jamais affichées.',
  'admin.env.callout.heading': 'Les valeurs vivent dans l’environnement de déploiement',
  'admin.env.declared.heading': 'Variables déclarées',
  'admin.env.declared.region': 'Variables d’environnement déclarées',
  'admin.env.required': 'Obligatoire',
  'admin.env.optional': 'Facultative',
  'admin.env.set': 'Définie',
  'admin.env.notSet': 'Non définie',
  'admin.env.fromEnvironment': 'Depuis l’environnement',
  'admin.env.fromDefault': 'Depuis la valeur par défaut déclarée',

  'admin.decisions.heading': 'Décisions',
  'admin.decisions.blurb':
    'Les décisions d’architecture que cette application déclare, et ce que chacune concernait.',
  'admin.decisions.register.region': 'Registre des décisions',
  'admin.decisions.provenance':
    'Déclarées dans app.ts. On les change là-bas et on redéploie, jamais ici.',
  'admin.decisions.one.heading': 'Décision',
  'admin.decisions.one.blurb':
    'Une décision du registre : la situation, le choix, et ce qui en découle.',
  'admin.decisions.back': 'Retour aux décisions',
  'admin.decisions.record.heading': 'Fiche',
  'admin.decisions.record.region': 'Fiche de la décision',
  'admin.decisions.part.context': 'Contexte',
  'admin.decisions.part.decision': 'Décision',
  'admin.decisions.part.consequences': 'Conséquences',
  'admin.decisions.field.status': 'Statut',
  'admin.decisions.field.date': 'Date',
  'admin.decisions.field.deciders': 'Décideurs',
  'admin.decisions.field.supersedes': 'Remplace',
  'admin.decisions.field.supersededBy': 'Remplacée par',
  'admin.decisions.field.touches': 'Concerne',
  'admin.decisions.field.source': 'Source',

  // Le verbe une seule fois, et c’est l’app de la personne qui est nommée —
  // jamais la nôtre. Ce que ça remplace ouvrait les deux lignes sur la même
  // formule et appelait la chose « ton app Sovrium » : le moteur avant l’app,
  // l’inverse de ce que fait le reste de la console. La fin de la phrase est
  // composée côté page (`pages/login.ts`), parce qu’un `$app.` ne se résout
  // pas dans une valeur traduite.
  'admin.login.heading': 'Connexion',
  'admin.login.blurb': 'La console d’exploitation de ',
  'admin.login.submit': 'Se connecter',
  'admin.login.pending': 'Connexion…',
  'admin.login.forgotLink': 'Mot de passe oublié ?',

  'admin.forgotPassword.heading': 'Mot de passe oublié',
  'admin.forgotPassword.blurb':
    'Saisis ton adresse e-mail. On t’envoie un lien pour définir un nouveau mot de passe.',
  'admin.forgotPassword.submit': 'Envoyer le lien',
  'admin.forgotPassword.pending': 'Envoi…',
  'admin.forgotPassword.expiry':
    'Le lien expire au bout d’une heure. Tu peux en demander un autre à tout moment.',

  'admin.resetPassword.heading': 'Nouveau mot de passe',
  'admin.resetPassword.blurb':
    'Choisis un nouveau mot de passe. Il remplace l’ancien immédiatement.',
  'admin.resetPassword.submit': 'Enregistrer le mot de passe',
  'admin.resetPassword.pending': 'Enregistrement…',
  'admin.resetPassword.singleUse':
    'Ce lien ne fonctionne qu’une seule fois. Demandes-en un nouveau si tu en as besoin.',

  'admin.auth.backToSignIn': 'Retour à la connexion',

  'admin.locked.audit.gdpr.exportScope':
    'Télécharge une archive JSON de tes données (profil, enregistrements que tu as créés, réponses de formulaire, activité).',
  'admin.locked.audit.gdpr.erasureNotice':
    'L’effacement est définitif et irréversible. Après un délai de grâce de 7 jours, ton compte et tes données sont supprimés pour de bon — ils ne peuvent pas être restaurés depuis la corbeille.',
  'admin.locked.audit.apiKeys.scopeNotice':
    'Identifiants de longue durée pour les scripts et les services qui appellent cette instance en ton nom. Présente-en un dans l’en-tête x-api-key. Une clé porte ton propre rôle — elle ne peut jamais faire plus que toi.',
  'admin.locked.audit.env.secrecyNotice':
    'Définis une variable là où tu fais tourner cette instance, puis redémarre. La console rapporte ce qui a été résolu ; elle ne stocke ni ne révèle jamais une valeur.',

  // ═══ data.ts ═══════════════════════════════════════════════════════════

  'admin.footprint.heading': 'Empreinte',
  'admin.footprint.blurb':
    'Ce que cette instance a consommé, et les leviers sous lesquels elle tourne. Chaque chiffre ci-dessous est soit mesuré par ce processus, soit déclaré par toi — chaque région dit lequel.',

  'admin.tables.heading': 'Enregistrements',
  'admin.tables.blurb':
    'Parcours et modifie les enregistrements de tes tables. Choisis une table pour ouvrir sa grille — cherche, trie, filtre, puis ouvre un enregistrement pour le modifier.',

  'admin.buckets.heading': 'Fichiers',
  'admin.buckets.blurb':
    'Parcours les fichiers stockés dans tes buckets. Choisis un bucket pour ouvrir son explorateur — cherche, trie, filtre par type, puis télécharge un fichier.',

  'admin.agents.heading': 'Conversations',
  'admin.agents.blurb':
    'Toutes les conversations que tes utilisateurs ont eues avec cet agent. Ouvres-en une pour lire le fil complet.',
  'admin.agents.blurbDefault':
    'L’agent généraliste : toutes les conversations qu’aucun agent déclaré n’a revendiquées. Ouvres-en une pour lire le fil complet.',

  'admin.forms.heading': 'Réponses',
  'admin.forms.blurb':
    'Passe en revue les réponses que tu as reçues, formulaire par formulaire. Choisis un formulaire pour parcourir sa boîte de réception, ouvrir une réponse, ou tout exporter en CSV.',

  'admin.connections.heading': 'Connexions',
  'admin.connections.blurb':
    'Inspecte les connexions de ton app aux services externes et l’état de leurs jetons : actif, bientôt expiré, ou expiré. Les connexions sont déclarées dans la config — ici, tu observes leur état réel.',

  // ── Organisation (`/organisation`) ──────────────────────────────────────
  //
  // Le vocabulaire de sécurité en français, fixé une fois ici pour les cinq
  // vues : « droit » pour *grant*, « source de droits » pour *grant source*,
  // « barreau ouvert » pour *open rung* (le `*` de la config), « constat » pour
  // *finding*. Un terme par notion, comme en anglais.
  'admin.organisation.heading': 'Organisation',
  'admin.organisation.blurb':
    'Ce que cette application expose : les chemins d’écriture accessibles sans connexion, les ressources lisibles par tout le monde, et les endroits où une seule personne relie deux parties de l’app. La matrice croise chaque ressource avec chaque source de droits, où une absence se lit aussi nettement qu’un droit. La carte dessine la chaîne elle-même — qui agit, ce qui l’autorise, et ce que cela atteint. Les couloirs dessinent l’autre moitié, celle où personne n’agit : chaque automatisation et les étapes qu’elle exécute seule.',
  'admin.organisation.tabs.region': 'Vues de l’organisation',
  'admin.organisation.findings.region': 'Constats structurels',
  'admin.organisation.findings.blurb':
    'Trois vérifications structurelles sur la configuration avec laquelle ce serveur tourne, refaites à chaque ouverture de la page. Rien n’est stocké et rien ne s’acquitte — un constat disparaît quand la configuration qui l’a causé change.',
  'admin.organisation.matrix.region': 'Matrice des droits',
  'admin.organisation.matrix.blurb':
    'Chaque ressource face à chaque source de droits, classées par privilège, le barreau ouvert en dernier. Une case est un droit, une case vide n’en est aucun — la moitié qu’une liste de constats ne peut pas montrer, parce que les trois vérifications rapportent ce qui est exposé et jamais ce qui est hors d’atteinte.',
  'admin.organisation.map.region': 'Carte des accès',
  'admin.organisation.map.blurb':
    'La chaîne que la matrice replie : les personnes et les agents qui agissent, les rôles, les équipes et le barreau ouvert qui les autorisent, et les ressources qu’ils atteignent — dessinés de gauche à droite, une ligne par droit. Sélectionner un élément suit sa chaîne et estompe ce qu’il ne touche pas. Le tableau en dessous porte les mêmes nœuds et les mêmes droits en texte.',
  'admin.organisation.processes.region': 'Couloirs d’automatisation',
  'admin.organisation.processes.blurb':
    'Ce qui tourne sans personne devant : chaque automatisation en couloir, et les étapes qu’elle parcourt, dans l’ordre où elle les parcourt. Un couloir en pointillés est en pause ; un couloir gris est désactivé dans la configuration. Le tableau en dessous porte les mêmes couloirs et les mêmes étapes en texte.',

  'admin.organisation.tabs.findings': 'Constats',
  'admin.organisation.tabs.matrix': 'Matrice',
  'admin.organisation.tabs.map': 'Carte',
  'admin.organisation.tabs.reach': 'Portée',
  'admin.organisation.tabs.processes': 'Processus',

  'admin.organisation.degraded.heading': 'Une partie du graphe n’a pas pu être lue.',
  'admin.organisation.degraded.body':
    'Les constats qui dépendent de la source non lue manquent, plutôt qu’ils n’existent pas : cette liste est donc incomplète. Regarde le journal du serveur pour l’erreur.',

  'admin.organisation.matrix.label':
    'Les ressources par source de droits. Le tableau en dessous porte les mêmes droits en texte.',
  'admin.organisation.matrix.empty':
    'Rien à croiser. Cette app ne déclare aucune ressource, ou aucun rôle, aucune équipe et aucun droit ouvert qui pourrait les atteindre.',
  'admin.organisation.matrix.flag': 'Par le barreau ouvert',

  'admin.organisation.map.label':
    'Qui atteint quoi, et par quel droit. Le tableau en dessous porte les mêmes nœuds et les mêmes droits en texte.',
  'admin.organisation.map.empty':
    'Rien à cartographier. Cette app ne déclare personne qui agit, aucune source de droits, ou aucune ressource qu’ils pourraient atteindre.',
  'admin.organisation.map.column.principals': 'Qui agit',
  'admin.organisation.map.column.grantSources': 'Sources de droits',
  'admin.organisation.map.column.resources': 'Ressources',

  'admin.organisation.processes.label':
    'Chaque automatisation en couloir, avec les étapes qu’elle y exécute. Le tableau en dessous porte les mêmes couloirs et les mêmes étapes en texte.',
  'admin.organisation.processes.empty':
    'Rien ne tourne tout seul. Cette app ne déclare aucune automatisation.',
  'admin.organisation.processes.lane': 'Automatisation',
  'admin.organisation.processes.stations': 'Étapes, dans l’ordre',

  'admin.organisation.reach.region': 'Le graphe d’accès en texte',
  'admin.organisation.reach.blurb':
    'Chaque relation du graphe, une par ligne — les mêmes faits que dessinent la carte et la grille, triables et copiables. Trie par Voie pour voir ce que le barreau ouvert atteint.',
  'admin.organisation.reach.things': 'Éléments',
  'admin.organisation.reach.relationships': 'Relations',
  'admin.organisation.reach.from': 'Source',
  'admin.organisation.reach.kind': 'Relation',
  'admin.organisation.reach.to': 'Cible',
  'admin.organisation.reach.ops': 'Permet',
  'admin.organisation.reach.route': 'Voie',
  'admin.organisation.reach.openRung': 'Barreau ouvert',
  'admin.organisation.reach.kind.member': 'tient le rôle',
  'admin.organisation.reach.kind.grant': 'reçoit',
  'admin.organisation.reach.kind.trigger': 'peut déclencher',
  'admin.organisation.reach.kind.escalation': 'escalade vers',
  'admin.organisation.reach.kind.step': 'puis',
  'admin.organisation.reach.empty':
    'Aucune relation. Rien dans cette app n’accorde quoi que ce soit à qui que ce soit.',

  // Position structurelle. Les quatre libellés sont des VERBES conjugués à la
  // troisième personne, parce qu’ils se lisent avec le nom de la personne à
  // gauche : « Léa Fontaine · Détient 2 · Atteint 14 ». Un substantif
  // (« Détentions ») casserait cette lecture, qui est toute la raison d’être
  // de la grille.
  'admin.organisation.reach.position.heading': 'Position structurelle',
  'admin.organisation.reach.position.holds': 'Détient',
  'admin.organisation.reach.position.reaches': 'Atteint',
  'admin.organisation.reach.position.writes': 'Modifie',
  'admin.organisation.reach.position.duplicateRoutes': 'Voies en double',

  // Restrictions déclarées, sous la grille de la Matrice.
  //
  // `scope` se dit « Axe » et non « Portée » : « Portée » est déjà le libellé
  // de l’onglet Reach juste à côté (`admin.organisation.tabs.reach`), et deux
  // sens pour un mot sur une même page est exactement ce qu’un glossaire
  // partagé doit empêcher. L’anglais garde « Scope », le mot du contrat.
  'admin.organisation.exceptions.heading': 'Là où une case ne dit pas tout',
  'admin.organisation.exceptions.resource': 'Ressource',
  'admin.organisation.exceptions.scope': 'Axe',
  'admin.organisation.exceptions.scope.field': 'Colonnes',
  'admin.organisation.exceptions.scope.row': 'Lignes',
  'admin.organisation.exceptions.op': 'Opération',
  'admin.organisation.exceptions.field': 'Champ',
  'admin.organisation.exceptions.rung': 'Accordé à',
  'admin.organisation.exceptions.rung.everyone': 'Tout le monde',
  'admin.organisation.exceptions.rung.anySession': 'Toute personne connectée',
  'admin.organisation.exceptions.rung.roles': 'Rôles nommés',
  'admin.organisation.exceptions.detail': 'Détail',
  'admin.organisation.exceptions.empty': 'Aucune restriction déclarée.',

  'admin.users.heading': 'Utilisateurs',
  'admin.users.blurb':
    'Gère les comptes de ton app : cherche un utilisateur, ajuste son rôle, ou suspends son accès. La création de compte passe par l’API admin (voir Développeurs → API).',
  'admin.users.tabs.region': 'Sous-vues Utilisateurs',
  'admin.users.account.heading': 'Compte',
  'admin.users.account.blurb':
    'Un compte\u00a0: son rôle et son statut, les écritures qu’une administratrice peut y faire, et ce que la console ne sait pas encore en montrer.',
  'admin.users.account.region': 'Compte',
  'admin.users.account.back': 'Retour aux utilisateurs',
  'admin.users.account.roles.region': 'Rôles assignables',
  'admin.users.account.roles.heading': 'Rôles assignables',
  'admin.users.account.roles.body':
    'Tous les rôles que cette app peut assigner, lus dans sa configuration. Les rôles sont déclarés dans auth.roles[]\u00a0; la console les lit et ne les écrit jamais.',
  'admin.users.account.gaps.region': 'Non montré ici',
  'admin.users.account.gaps.heading': 'Non montré ici',
  'admin.users.account.gaps.sessions.heading': 'Sessions ouvertes',
  'admin.users.account.gaps.sessions.body':
    'Fermer toutes les sessions se fait ci-dessus, dans les actions de la ligne. Les lister, non\u00a0: le point d’accès qui les renvoie répond à un POST, et une lecture de console est un GET.',
  'admin.users.account.gaps.teams.heading': 'Équipes',
  'admin.users.account.gaps.teams.body':
    'Les équipes sont déclarées dans auth.groups[]. Aucune lecture admin ne publie l’appartenance d’un compte, donc elle ne peut être ni montrée ni changée ici.',
  'admin.users.account.gaps.activity.heading': 'Dernière activité',
  'admin.users.account.gaps.activity.body':
    'L’annuaire renvoie id, e-mail, nom, rôle et statut. Un instant de dernière activité par compte demande une jointure sur la table des sessions, qu’aucune lecture ne fait.',

  'admin.invitations.heading': 'Invitations',
  'admin.invitations.blurb':
    'Invite quelqu’un sur cette app, vois quelles invitations sont encore en attente, et reprends-en une avant qu’elle soit acceptée.',

  'admin.pages.heading': 'Analytique',
  'admin.pages.blurb':
    'Mesure l’audience de tes pages sur les 30 derniers jours : vues, visiteurs et sessions, la tendance dans le temps, les pages les plus vues, d’où vient le trafic, avec quoi il navigue, et le journal brut des événements.',
  'admin.pages.blurbDisabled':
    'Mesure l’audience de tes pages — vues, visiteurs, sessions et leurs sources. L’analytique est désactivée pour cette app ; active-la pour commencer à collecter.',
  'admin.pages.tabs.region': 'Sous-vues Analytique',

  'admin.automations.heading': 'Exécutions',
  'admin.automations.blurb':
    'Toutes les exécutions de cette app, et les automatisations dont elles viennent. Mets-en une en pause pour arrêter son exécution sans changer ta config ; une automatisation désactivée dans ta config d’app ne peut être réactivée que là.',
  'admin.automations.tabs.region': 'Sous-vues Exécutions',
  'admin.automations.metrics.region': 'Indicateurs des exécutions',

  'admin.links.heading': 'Liens',
  'admin.links.blurb':
    'Vois comment tes liens courts performent, et ouvre celui que tu veux changer. Les chiffres viennent du même magasin de clics que lit la surface Analytique ; le catalogue ci-dessous liste chaque lien que cette instance sert, qu’il ait été déclaré dans la config ou créé ici.',

  'admin.agents.region': 'Conversations',
  'admin.agents.loading': 'Chargement des conversations…',
  'admin.automations.region': 'Automatisations',
  'admin.buckets.browser.region': 'Explorateur de fichiers',
  'admin.buckets.upload.region': 'Envoyer un fichier',
  'admin.connections.region': 'Connexions',
  'admin.forms.metrics.region': 'Indicateurs du formulaire',
  'admin.forms.submissions.region': 'Réponses',
  'admin.users.metrics.region': 'Indicateurs des utilisateurs',
  'admin.users.region': 'Utilisateurs',
  'admin.invitations.form.region': 'Inviter un coéquipier',
  'admin.invitations.pending.region': 'Invitations en attente',

  'admin.tables.empty.heading': 'Aucune table',
  'admin.tables.empty.body':
    'Cette app ne déclare encore aucune table. Ajoutes-en une dans ta config d’app pour commencer à capturer des enregistrements.',
  'admin.tables.empty.hint': 'Ajoute une table d’abord — les enregistrements suivront.',
  'admin.forms.empty.heading': 'Aucun formulaire',
  'admin.forms.empty.body':
    'Cette app ne déclare encore aucun formulaire. Ajoutes-en un dans ta config d’app pour commencer à recevoir des réponses.',
  'admin.forms.empty.hint': 'Aucun formulaire pour l’instant — la boîte de réception suivra.',
  'admin.automations.empty.heading': 'Aucune automatisation',
  'admin.automations.empty.body':
    'Cette app ne déclare encore aucune automatisation. Ajoutes-en une dans ta config d’app pour voir ses exécutions apparaître ici.',
  'admin.automations.empty.hint': 'Aucune automatisation pour l’instant — donc rien à exécuter.',

  'admin.automations.runs.heading': 'Historique des exécutions',
  'admin.automations.runs.scope':
    'Affiche les 25 exécutions les plus récentes. La recherche et les filtres interrogent toutes les exécutions et renvoient les 25 correspondances les plus récentes.',
  'admin.automations.runs.detail.configuredInCode':
    'Configurée dans le code, pas ici. Modifie la configuration de l’app puis redémarre.',

  'admin.forms.openForm': 'Ouvrir le formulaire',
  'admin.forms.conversion.heading': 'Taux de conversion',
  'admin.forms.conversion.why':
    'Le taux de conversion demande un compteur de vues — Sovrium ne le mesure pas encore.',
  'admin.forms.tabs.region': 'Sous-vues Réponses',
  'admin.forms.trend.region': 'Réponses dans le temps',
  'admin.forms.gaps.region': 'Chiffres pas encore mesurés',
  'admin.forms.gaps.heading': 'Pas encore mesuré',
  'admin.forms.metric.unmeasured': 'pas mesuré',
  'admin.forms.duration.heading': 'Temps de remplissage moyen',
  'admin.forms.duration.why':
    'Chronométrer une réponse demande le moment où le formulaire a été ouvert ; seul celui où elle est arrivée est enregistré.',
  'admin.forms.attachments.heading': 'Pièces jointes',
  'admin.forms.attachments.why':
    'Les compter demande de lire les données de chaque réponse, ce que la requête d’agrégat évite volontairement pour rester légère.',
  'admin.forms.dropOff.heading': 'Abandon par étape',
  'admin.forms.dropOff.why':
    'Savoir où quelqu’un s’est arrêté demande une trace des étapes atteintes ; un formulaire multi-étapes ne stocke que ce qu’il a reçu.',
  'admin.forms.export.region': 'Exporter en CSV',
  'admin.forms.scope':
    'Affiche les 25 réponses les plus récentes. La recherche interroge toutes les réponses et renvoie les 25 correspondances les plus récentes.',

  'admin.pages.metrics.region': 'Indicateurs d’audience',
  'admin.pages.trend.region': 'Tendance de l’audience',
  'admin.pages.top.region': 'Pages les plus vues',
  'admin.pages.acquisition.heading': 'Acquisition',
  'admin.pages.referrers.region': 'Principaux référents',
  'admin.pages.campaigns.region': 'Campagnes',
  'admin.pages.technology.heading': 'Technologie',
  'admin.pages.devices.region': 'Types d’appareil',
  'admin.pages.browsers.region': 'Navigateurs',
  'admin.pages.os.region': 'Systèmes d’exploitation',
  'admin.pages.events.heading': 'Journal des événements',
  'admin.pages.disabled.region': 'Analytique non activée',
  'admin.pages.disabled.heading': 'L’analytique n’est pas activée',
  'admin.pages.disabled.body':
    'Active l’analytique dans ta config d’app (analytics) pour mesurer l’audience, les visiteurs et les sessions de tes pages.',
  'admin.pages.disabled.hint': 'Rien à mesurer tant que l’analytique n’est pas activée.',

  'admin.links.period.region': 'Période',
  'admin.links.period.24h': '24 h',
  'admin.links.period.7d': '7 j',
  'admin.links.period.30d': '30 j',
  'admin.links.metrics.region': 'Indicateurs des liens',
  'admin.links.trend.region': 'Tendance des clics',
  'admin.links.catalog.region': 'Catalogue des liens',
  'admin.links.unavailable.region': 'Indicateurs des liens indisponibles',
  'admin.links.unavailable.heading': 'Les mesures de clics ne sont pas disponibles',
  'admin.links.unavailable.body':
    'Les clics sur les liens sont enregistrés par le moteur d’analytique intégré. Active l’analytique dans ta config d’app pour les mesurer — le catalogue ci-dessous fonctionne dans les deux cas.',
  'admin.links.definition.heading': 'Définition',
  'admin.links.definition.region': 'Définition du lien',
  'admin.links.qr.region': 'Code QR',
  'admin.links.qr.download': 'Télécharger le SVG',
  'admin.links.audience.heading': 'Audience',
  'admin.links.referrers.region': 'Référents',
  'admin.links.devices.region': 'Appareils',
  'admin.links.campaigns.region': 'Campagnes',
  'admin.links.clickLog.heading': 'Journal des clics',
  'admin.links.clickLog.region': 'Journal des clics',
  'admin.links.definition.full': 'Définition complète',
  'admin.links.create.region': 'Nouveau lien',
  'admin.links.create.heading': 'Nouveau lien',
  'admin.links.create.body':
    'Un slug et sa destination. Le titre, les paramètres de campagne et l’expiration se règlent sur la page du lien, une fois qu’il existe.',
  'admin.links.manage.region': 'Gérer ce lien',
  'admin.links.manage.heading': 'Gérer',
  'admin.links.manage.repoint': 'Rediriger ce lien',
  'admin.links.manage.config.heading': 'Déclaré dans la configuration',
  'admin.links.manage.config.body':
    'Ce lien est déclaré dans app.links[]. Modifie le fichier de configuration et redémarre pour le changer ; la console n’écrit jamais la configuration.',

  'admin.footprint.measured.heading': 'Mesuré',
  'admin.footprint.storage.heading': 'Stockage',
  'admin.footprint.storage.region': 'Consommateurs de stockage',
  'admin.footprint.configuration.heading': 'Configuration',
  'admin.footprint.levers.region': 'Leviers éco',
  'admin.footprint.rgesn.blurb':
    'L’écoconception est une pratique de conception, pas un état d’exécution, donc elle n’est pas notée ici. La façon dont le moteur se mesure au référentiel français est publiée une fois, pour toutes les installations :',
  'admin.footprint.rgesn.link': 'Comment Sovrium se situe face au RGESN 2024',

  'admin.locked.audit.footprint.measuredProvenance':
    'Mesuré par ce processus depuis son démarrage ; les compteurs sont remis à zéro quand il redémarre. Les notes lisent le Content-Length de chaque réponse via l’en-tête X-Eco-Index — ce n’est pas un score Lighthouse ou EcoIndex.fr, qui inspectent la page rendue. Mets ECO_INDEX_HEADER=on pour les enregistrer. Le taux de succès ne compte que les rendus proposés au cache : les requêtes authentifiées et dynamiques le contournent, donc une instance sans trafic anonyme affiche — plutôt qu’un taux.',
  'admin.locked.audit.footprint.storageProvenance':
    'Les trois plus gros consommateurs, mesurés à la demande. Chaque ligne nomme l’instrument derrière son chiffre, parce qu’une taille sans origine déclarée ne se distingue pas d’une taille que personne n’a prise. Une taille vide signifie que la sonde était indisponible — un zéro signifie que la ressource a été mesurée et qu’elle est vide.',
  'admin.locked.audit.footprint.configurationProvenance':
    'Lu depuis l’environnement à chaque requête, donc un changement prend effet au rafraîchissement suivant. La configuration est déclarée, pas mesurée : elle décrit comment cette instance est réglée, pas ce qu’elle a émis.',

  // ═══ developers.ts ═════════════════════════════════════════════════════

  'admin.api.heading': 'API',
  'admin.api.blurb':
    'Ton app expose une API REST générée depuis sa config. Chaque table devient un ensemble de points d’accès CRUD. Voici l’essentiel pour démarrer, plus la référence interactive complète.',
  'admin.api.access.heading': 'Accès',
  'admin.api.baseUrl.heading': 'URL de base',
  'admin.api.auth.heading': 'Authentification',
  'admin.api.auth.blurb':
    'Session Better Auth (cookie de connexion). Une requête envoyée depuis ce navigateur, connecté en tant qu’administrateur, est authentifiée automatiquement.',
  'admin.api.keys.heading': 'Clés API',
  'admin.api.keys.blurb':
    'Un script n’a pas de session de navigateur. Donne-lui plutôt une clé de longue durée et envoie-la dans l’en-tête x-api-key.',
  'admin.api.keys.link': 'Gérer les clés',
  'admin.api.tabs.region': 'Sous-vues API',
  'admin.api.keys.disabled.heading': 'Les clés API ne sont pas activées sur cette instance',
  'admin.api.keys.disabled.body':
    'Une clé de longue durée permet à un script d’appeler cette API sans session de navigateur. Les points d’accès qui émettent et révoquent les clés ne sont montés que si l’app les déclare.',
  'admin.api.keys.disabled.hint':
    'Passe auth.apiKeys à true dans la config de l’app, puis redémarre.',
  'admin.api.examples.heading': 'Exemples de requêtes',
  'admin.api.examples.note':
    'Le verbe et le chemin suffisent ; la référence interactive détaille les paramètres, les corps de requête et les réponses de chaque point d’accès.',
  'admin.api.createUser.heading': 'Créer un utilisateur',
  'admin.api.createUser.blurb':
    'La création de compte n’a plus de formulaire dans le tableau de bord : elle passe par l’API admin de Better Auth (ou le serveur MCP). Un mot de passe fort est requis ; la personne le réinitialise ensuite.',
  'admin.api.reference.heading': 'Référence interactive',
  'admin.api.reference.blurb':
    'Parcours chaque point d’accès, essaie des requêtes et lis les schémas dans la référence interactive (Scalar).',
  'admin.api.reference.link': 'Ouvrir la référence interactive',

  'admin.mcp.heading': 'MCP',
  'admin.mcp.blurb':
    'Connecte ton IA (Claude, Cursor…) à cette instance via MCP. Émets un identifiant, colle la config dans ton client, et ton IA atteint les outils ci-dessous — lecture et écriture de données, actions et automatisations.',
  'admin.mcp.tabs.region': 'Sous-vues MCP',
  'admin.mcp.clients.pending.heading': 'Les clients connectés ne sont pas encore listés',
  'admin.mcp.clients.pending.body':
    'Cette instance enregistre quels clients IA se sont inscrits, ce qu’ils ont accepté et quand ils ont appelé pour la dernière fois. Aucune lecture ne relie ces trois enregistrements, donc la console ne peut pas les montrer sans inventer la réponse.',
  'admin.mcp.clients.pending.hint':
    'En attendant, révoque l’accès d’un client depuis la config de l’app.',
  'admin.mcp.endpoint.heading': 'Point d’accès MCP',
  'admin.mcp.endpoint.blurb':
    'Ton serveur MCP est monté à cette adresse. Colle-la telle quelle dans la config de ton client IA.',
  'admin.mcp.credential.heading': 'Émettre un identifiant',
  'admin.mcp.credential.blurb':
    'Enregistre un client MCP pour obtenir un identifiant. La réponse renvoie un « client_id » et un « client_secret » à coller dans ton client IA. Lance-la connecté en tant qu’admin — sans session, le point d’accès répond 401, et « $SOVRIUM_SESSION » porte ton cookie de connexion.',
  'admin.mcp.credential.anonymous':
    'Claude Desktop, Cursor et ChatGPT Dev Mode s’enregistrent eux-mêmes avant qu’aucune session de navigateur n’existe. Pour le leur permettre, mets « SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true » — l’enregistrement accepte alors n’importe quel appelant, plafonné à 20 par minute et par IP.',
  'admin.mcp.config.heading': 'Configuration de référence',
  'admin.mcp.config.blurb':
    'La config MCP à coller dans ton client, avec le point d’accès déjà réglé sur l’adresse de cette instance.',
  'admin.mcp.tools.heading': 'Outils disponibles',
  'admin.mcp.tools.region': 'Outils MCP disponibles',
  'admin.mcp.tools.data': 'Données',
  'admin.mcp.tools.actions': 'Actions',
  'admin.mcp.tools.automations': 'Automatisations',
  'admin.mcp.tools.empty': 'Aucun outil exposé pour l’instant',
  'admin.mcp.tools.emptyHint':
    'Ajoute « aiAccess » à une table, une action ou une automatisation manuelle dans ta config d’app pour l’exposer ici comme outil MCP.',

  // ── Journal des versions (`/changelog`) ─────────────────────────────────
  'admin.changelog.heading': 'Journal des versions',
  'admin.changelog.blurb':
    'Chaque démarrage enregistré par cette instance, du plus récent au plus ancien, et ce qui a changé entre eux.',
  'admin.changelog.ledger.region': 'Journal des démarrages',
  'admin.changelog.ledger.blurb':
    'Une ligne par démarrage dont la version ou la configuration différait du précédent.',
  'admin.changelog.current': 'en cours',
  'admin.changelog.current.heading': 'Configuration telle qu’elle a démarré',
  'admin.changelog.current.declarations': 'déclarations',
  'admin.changelog.toCurrent': 'Lire la configuration telle qu’elle a démarré',
  'admin.changelog.back': 'Retour au journal',
  'admin.changelog.row.engine': 'Sovrium',
  'admin.changelog.row.migrations': 'migrations moteur appliquées',
  'admin.changelog.row.ddl': 'tables modifiées',

  // ── Un démarrage (`/changelog/:hash`) ───────────────────────────────────
  'admin.changelog.one.heading': 'Version',
  'admin.changelog.one.blurb':
    'Un démarrage enregistré : ce qu’il a appliqué à ta base, et en quoi sa configuration différait du démarrage précédent.',
  'admin.changelog.boot.region': 'Fiche du démarrage',
  'admin.changelog.boot.heading': 'Démarrage',
  'admin.changelog.field.version': 'Version',
  'admin.changelog.field.bootedAt': 'Démarré le',
  'admin.changelog.field.bootedBy': 'Lancé par',
  'admin.changelog.field.engine': 'Moteur',
  'admin.changelog.field.previousEngine': 'Moteur précédent',
  'admin.changelog.field.config': 'Config',
  'admin.changelog.field.previousConfig': 'Config précédente',
  'admin.changelog.field.id': 'Ligne',
  'admin.changelog.diff.heading': 'Différences de configuration',
  'admin.changelog.diff.baseline':
    'Le premier démarrage enregistré n’a rien avant lui à comparer : il ne porte donc aucune différence.',
  'admin.changelog.diff.pruned':
    'Le démarrage qui précédait celui-ci a été effacé par la rétention : il ne reste rien à comparer.',
  'admin.changelog.diff.redaction':
    'Les deux côtés de cette comparaison sont des démarrages qui ont eu lieu. Les secrets ont été masqués avant leur enregistrement. Exporte-la pour en lire les lignes.',
  'admin.changelog.ddl.heading': 'Tables modifiées',
  'admin.changelog.ddl.empty':
    'Aucune table modifiée : le moteur n’a rien déduit à appliquer depuis cette configuration.',
  'admin.changelog.migrations.heading': 'Migrations moteur',
  'admin.changelog.migrations.empty': 'Aucune : le moteur n’a pas changé.',

  // ── La configuration telle qu’elle a démarré (`?view=current`) ──────────
  'admin.schema.heading': 'Schéma',
  'admin.schema.declared.heading': 'Configuration déclarée',
  'admin.schema.declared.region': 'Configuration déclarée',
  'admin.schema.declared.empty': 'Cette config ne déclare encore rien.',
  'admin.schema.raw.heading': 'Configuration brute',
  'admin.schema.nav.region': 'Configuration',
  'admin.schema.nav.overview': 'Vue d’ensemble',
  'admin.schema.nav.rootKeys': 'Clés racine',
  'admin.schema.overview.body':
    'Ce avec quoi ce serveur a démarré, décodé et expurgé. Choisis une clé racine pour lire une famille\u00a0; la configuration entière est en dessous.',
  'admin.schema.counts.tables': 'Tables',
  'admin.schema.counts.pages': 'Pages',
  'admin.schema.counts.forms': 'Formulaires',
  'admin.schema.counts.automations': 'Automatisations',
  'admin.schema.counts.agents': 'Agents',
  'admin.schema.counts.buckets': 'Buckets',
  'admin.schema.counts.connections': 'Connexions',

  'admin.locked.audit.schema.readOnlyNotice':
    'Modifie ton fichier de config d’app et redémarre pour changer quoi que ce soit ici. La console lit la configuration qui tourne ; elle ne l’écrit jamais.',
  'admin.locked.audit.schema.redactionNotice':
    'La configuration depuis laquelle cette instance a démarré, exactement telle qu’elle tourne. Les identifiants sont expurgés avant la construction de la page.',
  'admin.locked.audit.mcp.exposureNotice':
    'Tu décides de ce que ton IA peut faire : rien n’est exposé par défaut.',

  'admin.schema.readOnly.heading': 'La configuration vit dans le code',
} as const
