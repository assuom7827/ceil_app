/**
 * Génère le gabarit d'attestation de départ, distribué dans `docs/`.
 *
 * Ce fichier n'est pas le gabarit « du produit » : c'est un **point de départ**
 * que le CEIL ouvre dans LibreOffice Writer, met en forme à sa main (logos,
 * cadre, signature, QR code) puis téléverse. Le générer depuis un script plutôt
 * que de le maintenir à la main garantit qu'il n'utilise que des repères que
 * l'application sait remplir — un test le vérifie.
 *
 *   npm run docs:attestation
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';

const OUTPUT = resolve(process.cwd(), 'docs/modele-attestation.odt');
const MIME = 'application/vnd.oasis.opendocument.text';

/** Les préfixes doivent être déclarés : LibreOffice refuse un XML qui les ignore. */
const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
].join(' ');

/** A4 paysage, comme demandé pour l'attestation. */
const STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.3">
<office:styles>
<style:style style:name="Standard" style:family="paragraph"><style:text-properties fo:font-size="11pt"/></style:style>
<style:style style:name="EnTete" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="11pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Titre" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center" fo:margin-top="0.5cm" fo:margin-bottom="0.3cm"/><style:text-properties fo:font-size="28pt" fo:font-weight="bold"/></style:style>
<style:style style:name="SousTitre" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.6cm"/><style:text-properties fo:font-size="13pt"/></style:style>
<style:style style:name="Corps" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="end" style:writing-mode="rl-tb" fo:margin-bottom="0.4cm" fo:line-height="150%"/><style:text-properties fo:font-size="13pt"/></style:style>
<style:style style:name="Numero" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="end" style:writing-mode="rl-tb"/><style:text-properties fo:font-size="11pt"/></style:style>
<style:style style:name="Encadre" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="10pt"/></style:style>
<style:style style:name="Signature" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="end" style:writing-mode="rl-tb" fo:margin-top="1cm"/><style:text-properties fo:font-size="12pt"/></style:style>
<style:style style:name="Mention" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="end" style:writing-mode="rl-tb" fo:margin-top="0.8cm"/><style:text-properties fo:font-size="10pt" fo:font-style="italic"/></style:style>
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="29.7cm" fo:page-height="21cm" style:print-orientation="landscape" fo:margin-top="1.2cm" fo:margin-bottom="1.2cm" fo:margin-left="1.5cm" fo:margin-right="1.5cm"/></style:page-layout>
</office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>`;

/**
 * Corps du document, calqué sur l'attestation réellement délivrée par le centre.
 *
 * Tout ce qui est FIXE est écrit en clair — l'administration le modifie dans
 * LibreOffice. Seules les valeurs variables sont des repères `{{…}}`.
 */
const PARAGRAPHS = [
  ['EnTete', 'الجمهورية الجزائرية الديمقراطية الشعبية'],
  ['EnTete', 'Algerian Popular and Democratic State'],
  ['EnTete', 'وزارة التعليم العالي و البحث العلمي'],
  ['EnTete', 'Ministry Of Higher Education and Scientific Research'],
  ['EnTete', 'جامعة عبد الحميد بن باديس - مستغانم'],
  ['EnTete', 'Abdelhamid Ben Badis University Of Mostaganem'],
  ['EnTete', 'مركز التعليم المكثف للغات'],
  ['EnTete', 'Intensive Teaching Languages Center (ITLC)'],
  ['Numero', 'رقم : {{matricule}}'],
  ['Titre', 'شهادة نجاح'],
  ['SousTitre', 'Achievement certificate'],
  [
    'Corps',
    'تشهد مديرية مركز التعليم المكثف للغات أن {{civiliteArabe}} {{nomCompletArabe}} المولود(ة) في {{dateNaissanceInverse}} بـ {{lieuNaissanceArabe}}',
  ],
  ['Corps', 'قد تابع التكوين في : {{langueArabe}}'],
  [
    'Corps',
    'و اجتاز بنجاح إمتحان الكفاءات اللغوية لمستوى {{niveau}} (حسب الإطار الأوروبي المرجعي العام للغات) {{sessionArabe}}',
  ],
  ['Encadre', 'Name : {{nomLatin}}'],
  ['Encadre', 'Surname : {{prenomLatin}}'],
  ['Encadre', 'Date of birth : {{dateNaissanceInverse}} in {{lieuNaissance}}'],
  ['Encadre', 'Language : {{langue}}'],
  ['Encadre', 'Level : {{niveau}}'],
  ['Signature', 'مستغانم في {{dateDelivranceInverse}}'],
  ['Signature', 'مديرة المركز'],
  ['Mention', 'لا تستخرج إلا نسخة واحدة من هذه الشهادة'],
] as const;

const body = PARAGRAPHS.map(
  ([style, texte]) => `<text:p text:style-name="${style}">${texte}</text:p>`,
).join('');

const CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.3">
<office:automatic-styles/>
<office:body><office:text>${body}</office:text></office:body>
</office:document-content>`;

/** Sans manifeste, LibreOffice refuse le document sans rien dire. */
const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

// `mimetype` en premier et non compressé : c'est la signature du paquet ODF.
const archive = zipSync(
  {
    mimetype: [strToU8(MIME), { level: 0 }],
    'META-INF/manifest.xml': strToU8(MANIFEST),
    'content.xml': strToU8(CONTENT),
    'styles.xml': strToU8(STYLES),
  },
  { level: 6 },
);

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, archive);

console.log(`Gabarit d'attestation écrit dans ${OUTPUT}`);
