/**
 * Catalogue des repères d'un gabarit d'attestation.
 *
 * Ce fichier est **pur et sans aucun import** : l'API s'en sert pour remplir le
 * gabarit, et l'écran des modèles de diplôme pour afficher à l'administration la
 * liste de ce qu'elle peut écrire dans son fichier LibreOffice. Une seule
 * définition, donc aucune liste d'aide qui mentirait sur ce que le code sait
 * faire.
 */
export interface PlaceholderDoc {
  name: string;
  description: string;
}

export const CERTIFICATE_PLACEHOLDERS: ReadonlyArray<PlaceholderDoc> = Object.freeze([
  { name: 'nomLatin', description: 'Nom de famille en caractères latins' },
  { name: 'prenomLatin', description: 'Prénom en caractères latins' },
  { name: 'nomComplet', description: 'Nom et prénom latins' },
  { name: 'nomArabe', description: 'Nom de famille en arabe' },
  { name: 'prenomArabe', description: 'Prénom en arabe' },
  { name: 'nomCompletArabe', description: 'Nom et prénom en arabe' },
  { name: 'civiliteArabe', description: 'السيد / السيدة, selon le sexe renseigné' },
  { name: 'dateNaissance', description: 'Date de naissance, JJ/MM/AAAA' },
  { name: 'dateNaissanceInverse', description: 'Date de naissance, AAAA/MM/JJ' },
  { name: 'lieuNaissance', description: 'Lieu de naissance en caractères latins' },
  { name: 'lieuNaissanceArabe', description: 'Lieu de naissance en arabe' },
  { name: 'langue', description: 'Langue de la formation, en français' },
  { name: 'langueArabe', description: 'Langue de la formation, en arabe' },
  { name: 'niveau', description: 'Niveau CECRL obtenu, ex. B1.2' },
  { name: 'session', description: 'Intitulé de la session' },
  { name: 'sessionArabe', description: 'دورة suivi du mois de début et de l’année' },
  { name: 'anneeUniversitaire', description: 'Année universitaire de la session' },
  { name: 'moisArabeDebut', description: 'Mois de début de session, en arabe' },
  { name: 'moisArabeFin', description: 'Mois de fin de session, en arabe' },
  { name: 'anneeDebut', description: 'Année de début de session' },
  { name: 'anneeFin', description: 'Année de fin de session' },
  { name: 'matricule', description: 'Matricule d’inscription à la session' },
  { name: 'matriculeParticipant', description: 'Matricule permanent du participant' },
  { name: 'total', description: 'Total des quatre compétences' },
  { name: 'seuil', description: 'Seuil d’admission de la session' },
  { name: 'dateDelivrance', description: 'Date d’édition du document, JJ/MM/AAAA' },
  { name: 'dateDelivranceInverse', description: 'Date d’édition, AAAA/MM/JJ' },
]);

export const ATTESTATION_PLACEHOLDERS: ReadonlyArray<PlaceholderDoc> = Object.freeze([
  { name: 'anneeUniversitaire', description: 'Année universitaire de la session' },
  { name: 'institution', description: 'Nom de l’établissement / du centre' },
  { name: 'civiliteArabe', description: 'السيد / السيدة, selon le sexe renseigné' },
  { name: 'nomCompletArabe', description: 'Nom et prénom en arabe' },
  { name: 'dateNaissance', description: 'Date de naissance, JJ/MM/AAAA' },
  { name: 'dateNaissanceInverse', description: 'Date de naissance, AAAA/MM/JJ' },
  { name: 'lieuNaissanceArabe', description: 'Lieu de naissance en arabe' },
  { name: 'matricule', description: 'Matricule d’inscription à la session' },
  { name: 'langue', description: 'Langue de la formation, en français' },
  { name: 'langueArabe', description: 'Langue de la formation, en arabe' },
  { name: 'niveau', description: 'Niveau CECRL de l’inscription' },
  { name: 'groupe', description: 'Groupe de session ou d’examen' },
  { name: 'lieuEdition', description: 'Lieu d’édition de l’attestation' },
  { name: 'dateEdition', description: "Date d’édition, JJ/MM/AAAA" },
  { name: 'dateEditionInverse', description: "Date d’édition, AAAA/MM/JJ" },
  { name: 'directeur', description: 'Titre du signataire (ex. Le Directeur)' },
]);

export const KNOWN_PLACEHOLDER_NAMES: ReadonlySet<string> = new Set([
  ...CERTIFICATE_PLACEHOLDERS.map((entry) => entry.name),
  ...ATTESTATION_PLACEHOLDERS.map((entry) => entry.name),
]);
