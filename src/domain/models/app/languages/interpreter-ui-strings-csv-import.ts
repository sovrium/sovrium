/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of the CSV import wizard an `openImport` button
 * opens: its three steps (File, Columns, Check), the file line, the column
 * mapping table, the values of a choice column to match to options, the
 * duplicate handling and the outcome. Part of {@link INTERPRETER_UI_STRINGS}
 * through the components table; kept apart only so no file outgrows its
 * ceiling. English is the wizard's own literal word for word, and an author
 * renames any key under `sovrium.<key>`.
 */
export const CSV_IMPORT_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'csvImport.title': { en: 'Import CSV', fr: 'Importer un CSV' },
  /** The name of the step list, and its three steps. */
  'csvImport.steps': { en: 'Import steps', fr: 'Étapes de l’import' },
  'csvImport.stepFile': { en: 'File', fr: 'Fichier' },
  'csvImport.stepColumns': { en: 'Columns', fr: 'Colonnes' },
  'csvImport.stepCheck': { en: 'Check', fr: 'Vérification' },
  /** The File step before a file is chosen. */
  'csvImport.drop': {
    en: 'Drag and drop a CSV file here',
    fr: 'Glissez-déposez un fichier CSV ici',
  },
  'csvImport.browse': { en: 'Browse file', fr: 'Parcourir les fichiers' },
  'csvImport.noRows': { en: 'No data rows found', fr: 'Aucune ligne de données trouvée' },
  /** The file line: how many rows the file holds, and the separator it was read with. */
  'csvImport.rowCount': { en: '{count} rows', fr: '{count} lignes' },
  'csvImport.rowCountOne': { en: '{count} row', fr: '{count} ligne' },
  'csvImport.separator': { en: 'separator {separator}', fr: 'séparateur {separator}' },
  'csvImport.next': { en: 'Next', fr: 'Suivant' },
  'csvImport.import': { en: 'Import', fr: 'Importer' },
  'csvImport.cancel': { en: 'Cancel', fr: 'Annuler' },
  'csvImport.done': { en: 'Done', fr: 'Terminé' },
  /** The Columns step: the mapping table's name and its four headings. */
  'csvImport.mapping': { en: 'Column mapping', fr: 'Correspondance des colonnes' },
  'csvImport.csvColumn': { en: 'CSV column', fr: 'Colonne du CSV' },
  'csvImport.firstRow': { en: 'First row', fr: 'Première ligne' },
  'csvImport.field': { en: 'Field', fr: 'Champ' },
  'csvImport.reading': { en: 'How it is read', fr: 'Lecture' },
  /** A column mapped to no field, and what its reading cell says. */
  'csvImport.skip': { en: 'Skip', fr: 'Ignorer' },
  'csvImport.fieldFor': { en: 'Field for column {column}', fr: 'Champ pour la colonne {column}' },
  'csvImport.notImported': { en: 'Not imported', fr: 'Non importée' },
  /** The rows after the first, shown while the pointer rests on a column. */
  'csvImport.nextRows': { en: 'Next rows:', fr: 'Lignes suivantes :' },
  'csvImport.requiredUnmapped': {
    en: "Required field '{field}' has no mapping",
    fr: 'Le champ obligatoire « {field} » n’a pas de correspondance',
  },
  /** A choice column holding values the field has no option for. */
  'csvImport.unknownValues': {
    en: 'Values of {field} with no matching option',
    fr: 'Valeurs de {field} sans option correspondante',
  },
  'csvImport.leaveEmpty': { en: 'Leave empty', fr: 'Laisser vide' },
  /** How a field reads the column it is given, by kind of field. */
  'csvImport.readText': { en: 'Text', fr: 'Texte' },
  'csvImport.readNumber': { en: 'Number', fr: 'Nombre' },
  'csvImport.readCurrency': { en: 'Currency · {currency}', fr: 'Montant · {currency}' },
  'csvImport.readPercentage': { en: 'Percentage', fr: 'Pourcentage' },
  'csvImport.readDate': { en: 'Date', fr: 'Date' },
  'csvImport.readDateTime': { en: 'Date and time', fr: 'Date et heure' },
  'csvImport.readTime': { en: 'Time', fr: 'Heure' },
  'csvImport.readCheckbox': { en: 'Yes or no', fr: 'Oui ou non' },
  'csvImport.readSingleSelect': { en: 'Single select', fr: 'Choix unique' },
  'csvImport.readMultiSelect': { en: 'Multiple select', fr: 'Choix multiple' },
  'csvImport.readEmail': { en: 'Email', fr: 'E-mail' },
  'csvImport.readUrl': { en: 'Link', fr: 'Lien' },
  'csvImport.readPhone': { en: 'Phone number', fr: 'Numéro de téléphone' },
  'csvImport.readRelationship': { en: 'Linked record', fr: 'Enregistrement lié' },
  /** The Check step: what to do with a row that matches an existing record. */
  'csvImport.duplicates': {
    en: 'How should duplicate records be handled?',
    fr: 'Que faire des enregistrements en double ?',
  },
  'csvImport.skipDuplicates': { en: 'Skip duplicates', fr: 'Ignorer les doublons' },
  'csvImport.overwriteDuplicates': { en: 'Overwrite duplicates', fr: 'Écraser les doublons' },
  'csvImport.createNew': { en: 'Create new records', fr: 'Créer de nouveaux enregistrements' },
  'csvImport.uniqueField': { en: 'Unique field', fr: 'Champ unique' },
  'csvImport.selectField': { en: 'Select a field…', fr: 'Choisir un champ…' },
  /** The import running, and what it did. */
  'csvImport.importing': { en: 'Importing records', fr: 'Import des enregistrements' },
  'csvImport.imported': {
    en: '{count} records imported successfully',
    fr: '{count} enregistrements importés',
  },
  'csvImport.created': { en: '{count} records created', fr: '{count} enregistrements créés' },
  'csvImport.updated': { en: '{count} records updated', fr: '{count} enregistrements mis à jour' },
  'csvImport.skipped': {
    en: '{count} records skipped (duplicates)',
    fr: '{count} enregistrements ignorés (doublons)',
  },
  'csvImport.failed': { en: '{count} records failed', fr: '{count} enregistrements en échec' },
  'csvImport.errorReport': { en: 'Download error report', fr: 'Télécharger le rapport d’erreurs' },
}
