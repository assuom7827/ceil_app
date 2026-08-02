/**
 * Manipulation de gabarits ODT (OpenDocument Text).
 *
 * Un `.odt` est une archive ZIP dont `content.xml` porte le corps du document et
 * `styles.xml` les en-têtes, pieds de page et mises en page. Remplir un gabarit
 * revient donc à substituer des repères `{{…}}` dans ces deux fichiers, sans
 * toucher au reste de l'archive — images, polices, styles restent intacts.
 *
 * Ce fichier est **pur** : ni Prisma, ni système de fichiers, ni processus
 * externe. Il se teste donc entièrement sans base et sans LibreOffice.
 */
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { validationError } from './errors';

/** Fichiers de l'archive où les repères sont cherchés. */
export const SUBSTITUTED_PARTS = ['content.xml', 'styles.xml'] as const;

const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/**
 * Repère de substitution : `{{nom}}`.
 *
 * Les espaces internes sont tolérés — LibreOffice n'en ajoute pas, mais une
 * saisie humaine le fait volontiers.
 */
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/**
 * Repère dont le texte a été coupé par des balises.
 *
 * LibreOffice découpe un paragraphe en `<text:span>` dès qu'un attribut change —
 * correction orthographique, langue, mise en forme partielle. `{{nomComplet}}`
 * peut donc s'écrire `{{nom</text:span><text:span>Complet}}` dans le fichier,
 * et aucune substitution naïve ne le retrouverait.
 */
const FRAGMENTED = /\{\{(?:[^{}]|\{(?!\{))*?\}\}/g;

export type OdtEntries = Record<string, Uint8Array>;

/** Ouvre une archive ODT. Rejette ce qui n'en est pas une (400). */
export function readOdt(file: Uint8Array): OdtEntries {
  let entries: OdtEntries;
  try {
    entries = unzipSync(file);
  } catch {
    throw validationError('Fichier illisible : un gabarit doit être un fichier ODT (LibreOffice).');
  }

  const mimetype = entries['mimetype'] ? strFromU8(entries['mimetype']).trim() : null;
  if (mimetype !== ODT_MIME) {
    throw validationError(
      'Ce fichier n’est pas un document texte ODT. Enregistrez-le depuis LibreOffice Writer au format « Texte ODF (.odt) ».',
      { mimetype },
    );
  }
  if (!entries['content.xml']) {
    throw validationError('Gabarit incomplet : `content.xml` est absent de l’archive.');
  }
  /**
   * Sans manifeste, LibreOffice refuse le document en **rendant la main sans
   * rien produire** : aucune erreur, aucun PDF. Le défaut se découvrirait à
   * l'impression, donc il est arrêté ici.
   */
  if (!entries['META-INF/manifest.xml']) {
    throw validationError(
      'Gabarit incomplet : le manifeste `META-INF/manifest.xml` est absent. Réenregistrez le fichier depuis LibreOffice Writer plutôt que de le recomposer à la main.',
    );
  }
  return entries;
}

/**
 * Réécrit l'archive.
 *
 * `mimetype` doit rester la **première entrée et non compressée** : c'est ainsi
 * qu'un lecteur ODF reconnaît le type du paquet sans le décompresser. Le perdre
 * produit un fichier que LibreOffice ouvre encore, mais que des outils plus
 * stricts refusent.
 */
export function writeOdt(entries: OdtEntries): Uint8Array {
  const { mimetype, ...rest } = entries;
  if (!mimetype) throw validationError('Gabarit incomplet : `mimetype` est absent de l’archive.');
  return zipSync({ mimetype: [mimetype, { level: 0 }], ...rest }, { level: 6 });
}

/**
 * Recolle les repères coupés par des balises.
 *
 * Les balises internes au repère sont supprimées ; celles qui l'entourent ne
 * sont pas touchées, donc la mise en forme du premier fragment s'applique à tout
 * le repère — ce qui est le comportement attendu.
 *
 * Un repère qui enjambe une **fin de paragraphe** est laissé tel quel : le
 * recoller fusionnerait deux paragraphes, et il vaut mieux qu'il ressorte comme
 * non résolu que de déformer le document en silence.
 */
export function mendPlaceholders(xml: string): string {
  return xml.replace(FRAGMENTED, (match) => {
    if (!match.includes('<')) return match;
    if (/<\/text:p>|<text:p[\s>]|<\/table:table-cell>/.test(match)) return match;
    return match.replace(/<[^>]*>/g, '');
  });
}

/** Repères présents dans un XML, dédoublonnés, dans l'ordre de rencontre. */
export function findPlaceholders(xml: string): string[] {
  const found = new Set<string>();
  for (const match of mendPlaceholders(xml).matchAll(PLACEHOLDER)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

/** Repères présents dans l'ensemble du gabarit. */
export function listTemplatePlaceholders(file: Uint8Array): string[] {
  const entries = readOdt(file);
  const found = new Set<string>();
  for (const part of SUBSTITUTED_PARTS) {
    const content = entries[part];
    if (content) for (const name of findPlaceholders(strFromU8(content))) found.add(name);
  }
  return [...found];
}

/** Échappe une valeur destinée à du contenu XML. */
export function escapeXml(value: string): string {
  return (
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Un retour à la ligne dans une valeur doit rester un retour à la ligne dans
      // le document. Introduit après l'échappement, puisqu'il ajoute une balise.
      .replace(/\r\n|\r|\n/g, '<text:line-break/>')
  );
}

export interface FillResult {
  xml: string;
  /** Repères du gabarit pour lesquels aucune valeur n'a été fournie. */
  unresolved: string[];
}

/**
 * Substitue les repères d'un XML.
 *
 * Un repère sans valeur est **laissé visible** dans le document et signalé :
 * l'effacer donnerait une attestation officielle amputée sans que personne ne
 * s'en aperçoive.
 */
export function fillXml(xml: string, values: Readonly<Record<string, string>>): FillResult {
  const unresolved = new Set<string>();
  const filled = mendPlaceholders(xml).replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    if (value === undefined) {
      unresolved.add(name);
      return match;
    }
    return escapeXml(value);
  });
  return { xml: filled, unresolved: [...unresolved] };
}

export interface RenderedOdt {
  file: Uint8Array;
  unresolved: string[];
}

/** Remplit un gabarit pour **un** destinataire. */
export function fillTemplate(
  file: Uint8Array,
  values: Readonly<Record<string, string>>,
): RenderedOdt {
  return fillTemplateMany(file, [values]);
}

/**
 * Remplit un gabarit pour plusieurs destinataires, une page par destinataire.
 *
 * Le corps du document est répété autant de fois que nécessaire, chaque copie
 * commençant sur une nouvelle page. Un seul fichier est produit, donc une seule
 * conversion PDF et une seule impression — imprimer cent attestations une par
 * une n'est pas un geste tenable.
 *
 * `styles.xml` n'est PAS répété : en-têtes, pieds de page et fonds y sont
 * définis une fois pour toutes les pages. Les repères qu'il contient sont donc
 * remplis avec les valeurs du **premier** destinataire, ce qui n'a de sens que
 * pour des valeurs communes (session, année) — c'est documenté.
 */
export function fillTemplateMany(
  file: Uint8Array,
  recipients: ReadonlyArray<Readonly<Record<string, string>>>,
): RenderedOdt {
  if (recipients.length === 0) {
    throw validationError('Aucun destinataire : rien à produire.');
  }

  const entries = readOdt(file);
  const unresolved = new Set<string>();
  const output: OdtEntries = { ...entries };

  // Chaque copie est remplie séparément : les repères d'une page ne doivent
  // jamais recevoir les valeurs d'une autre.
  const repeated = repeatBody(strFromU8(entries['content.xml']!), recipients.length);
  const parts = splitCopies(repeated, recipients.length);
  const rebuilt = parts.body
    .map((copy, position) => {
      const result = fillXml(copy, recipients[position]!);
      for (const name of result.unresolved) unresolved.add(name);
      return result.xml;
    })
    .join('');
  output['content.xml'] = strToU8(parts.prefix + rebuilt + parts.suffix);

  const styles = entries['styles.xml'];
  if (styles) {
    const result = fillXml(strFromU8(styles), recipients[0]!);
    for (const name of result.unresolved) unresolved.add(name);
    output['styles.xml'] = strToU8(result.xml);
  }

  return { file: writeOdt(output), unresolved: [...unresolved] };
}

// ---------------------------------------------------------------------------
// Répétition du corps
// ---------------------------------------------------------------------------

/** Nom du style de saut de page ajouté au gabarit. */
const PAGE_BREAK_STYLE = 'CeilSautDePage';
const BODY = /(<office:text\b[^>]*>)([\s\S]*)(<\/office:text>)/;
const PAGE_BREAK_MARKER = `<text:p text:style-name="${PAGE_BREAK_STYLE}"><text:line-break/></text:p>`;
/**
 * Déclarations à ne pas dupliquer : compteurs de séquence, variables et
 * formulaires sont définis une fois pour le document entier.
 */
const DECLARATIONS =
  /^\s*(?:<text:(?:sequence|variable|user-field)-decls\b[\s\S]*?<\/text:(?:sequence|variable|user-field)-decls>|<text:(?:sequence|variable|user-field)-decls\b[^>]*\/>|<office:forms\b[\s\S]*?<\/office:forms>|<office:forms\b[^>]*\/>)\s*/;

/**
 * Répète le corps de `content.xml`, en insérant un saut de page entre les copies.
 *
 * Le saut est porté par un paragraphe vide de style `fo:break-before="page"`
 * plutôt qu'en modifiant le style du premier paragraphe de chaque copie : le
 * gabarit reste ainsi intact, et un seul style est ajouté à l'archive.
 */
export function repeatBody(contentXml: string, copies: number): string {
  if (copies <= 1) return contentXml;

  const match = BODY.exec(contentXml);
  if (!match) {
    throw validationError(
      'Gabarit inattendu : `<office:text>` est introuvable dans `content.xml`.',
    );
  }

  const [, open, inner, close] = match as unknown as [string, string, string, string];
  const declarations = DECLARATIONS.exec(inner)?.[0] ?? '';
  const body = inner.slice(declarations.length).replace(new RegExp(`<text:p text:style-name="${PAGE_BREAK_STYLE}"[^>]*>`, 'g'), '').trim();

  const repeated = Array.from({ length: copies }, (_, position) =>
    position === 0 ? body : PAGE_BREAK_MARKER + body,
  ).join('');

  return withPageBreakStyle(
    contentXml.replace(BODY, () => `${open}${declarations}${repeated}${close}`),
  );
}

/** Ajoute le style de saut de page aux styles automatiques du document. */
function withPageBreakStyle(contentXml: string): string {
  const style =
    `<style:style style:name="${PAGE_BREAK_STYLE}" style:family="paragraph" style:parent-style-name="Standard">` +
    `<style:paragraph-properties fo:break-before="page"/>` +
    `</style:style>`;

  if (/<office:automatic-styles\s*\/>/.test(contentXml)) {
    return contentXml.replace(
      /<office:automatic-styles\s*\/>/,
      `<office:automatic-styles>${style}</office:automatic-styles>`,
    );
  }
  if (/<office:automatic-styles\b[^>]*>/.test(contentXml)) {
    return contentXml.replace(/(<office:automatic-styles\b[^>]*>)/, `$1${style}`);
  }
  // Aucun bloc de styles automatiques : en insérer un avant le corps.
  return contentXml.replace(
    /(<office:body\b)/,
    `<office:automatic-styles>${style}</office:automatic-styles>$1`,
  );
}

/**
 * Redécoupe le corps répété en copies, pour les remplir indépendamment.
 *
 * Le découpage se fait sur le paragraphe de saut de page, qui n'apparaît nulle
 * part ailleurs puisque son style est ajouté par cette couche.
 */
function splitCopies(
  contentXml: string,
  copies: number,
): { prefix: string; body: string[]; suffix: string } {
  const match = BODY.exec(contentXml);
  if (!match) {
    throw validationError(
      'Gabarit inattendu : `<office:text>` est introuvable dans `content.xml`.',
    );
  }
  const [whole, open, inner, close] = match as unknown as [string, string, string, string];
  const start = contentXml.indexOf(whole);
  const prefix = contentXml.slice(0, start) + open;
  const suffix = close + contentXml.slice(start + whole.length);

  if (copies <= 1) return { prefix, body: [inner], suffix };

  const declarations = DECLARATIONS.exec(inner)?.[0] ?? '';
  const pieces = inner.slice(declarations.length).split(PAGE_BREAK_MARKER);
  return {
    prefix: prefix + declarations,
    body: pieces.map((piece, position) => (position === 0 ? piece : PAGE_BREAK_MARKER + piece)),
    suffix,
  };
}

/**
 * Injecte des QR codes comme images dans un ODT rendu.
 *
 * Chaque `{{qrCode}}` dans content.xml est remplacé par une balise
 * `<draw:frame><draw:image .../></draw:frame>` pointant vers un fichier
 * `Pictures/qr-{enrollmentId}.png` ajouté à l'archive.
 *
 * manifest.xml est mis à jour en conséquence.
 */
export function injectQrCodes(
  file: Uint8Array,
  qrCodes: ReadonlyArray<{ enrollmentId: string; data: Uint8Array }>,
): Uint8Array {
  if (qrCodes.length === 0) return file;

  const entries = readOdt(file);
  let content = strFromU8(entries['content.xml']!);

  let qrIndex = 0;
  content = content.replace(/\{\{qrCode\}\}/g, () => {
    const qr = qrCodes[qrIndex++];
    if (!qr) return '';
    const fileName = `Pictures/qr-${qr.enrollmentId}.png`;
    entries[fileName] = qr.data;
    return `<draw:frame draw:name="QR-${qr.enrollmentId}" draw:style-name="fr1" draw:width="2cm" draw:height="2cm"><draw:image xlink:href="${fileName}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
  });

  entries['content.xml'] = strToU8(content);

  let manifest = entries['META-INF/manifest.xml'] ? strFromU8(entries['META-INF/manifest.xml']!) : '';
  for (const qr of qrCodes) {
    const fileName = `Pictures/qr-${qr.enrollmentId}.png`;
    if (!manifest.includes(fileName)) {
      manifest = manifest.replace(
        '</manifest:manifest>',
        `<manifest:file-entry manifest:full-path="${fileName}" manifest:media-type="image/png"/></manifest:manifest>`,
      );
    }
  }
  entries['META-INF/manifest.xml'] = strToU8(manifest);

  return writeOdt(entries);
}
