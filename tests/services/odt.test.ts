/**
 * Manipulation des gabarits ODT.
 *
 * Une substitution ratée ne se voit pas à l'écran : elle s'imprime sur une
 * attestation officielle. Chaque cas — repère coupé par une balise, valeur à
 * échapper, page par destinataire — est donc figé ici, sans LibreOffice.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { CERTIFICATE_PLACEHOLDERS, unknownPlaceholders } from '@/services/certificates';
import {
  escapeXml,
  fillTemplate,
  fillTemplateMany,
  fillXml,
  findPlaceholders,
  listTemplatePlaceholders,
  mendPlaceholders,
  readOdt,
  repeatBody,
  writeOdt,
} from '@/services/odt';

const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/**
 * Déclarations d'espaces de noms, comme dans un fichier réel : LibreOffice
 * refuse un `content.xml` qui utilise les préfixes sans les déclarer.
 */
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';

/** Manifeste minimal — sans lui, LibreOffice ne produit rien, en silence. */
const MANIFEST =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">' +
  `<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIME}"/>` +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '</manifest:manifest>';

function contentXml(body: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<office:document-content ${NS} office:version="1.3">` +
    '<office:automatic-styles/>' +
    `<office:body><office:text>${body}</office:text></office:body>` +
    '</office:document-content>'
  );
}

/** Construit un ODT minimal mais valide, comme en produirait LibreOffice. */
function buildOdt(body: string, styles?: string): Uint8Array {
  return zipSync({
    mimetype: [strToU8(ODT_MIME), { level: 0 }],
    'META-INF/manifest.xml': strToU8(MANIFEST),
    'content.xml': strToU8(contentXml(body)),
    ...(styles ? { 'styles.xml': strToU8(styles) } : {}),
  });
}

function bodyOf(file: Uint8Array): string {
  return strFromU8(unzipSync(file)['content.xml']!);
}

describe('lecture et écriture de l’archive', () => {
  it('refuse ce qui n’est pas une archive', () => {
    expect(() => readOdt(strToU8('ceci est un texte'))).toThrowError(/ODT/);
  });

  it('refuse une archive qui n’est pas un document texte', () => {
    const classeur = zipSync({
      mimetype: [strToU8('application/vnd.oasis.opendocument.spreadsheet'), { level: 0 }],
      'content.xml': strToU8('<x/>'),
    });
    expect(() => readOdt(classeur)).toThrowError(/document texte ODT/);
  });

  it('refuse une archive sans content.xml', () => {
    const vide = zipSync({ mimetype: [strToU8(ODT_MIME), { level: 0 }] });
    expect(() => readOdt(vide)).toThrowError(/content\.xml/);
  });

  /**
   * Sans manifeste, LibreOffice rend la main sans produire de PDF ni d'erreur.
   * Le refus doit donc tomber au téléversement, pas à l'impression.
   */
  it('refuse une archive sans manifeste', () => {
    const sansManifeste = zipSync({
      mimetype: [strToU8(ODT_MIME), { level: 0 }],
      'content.xml': strToU8(contentXml('<text:p>x</text:p>')),
    });
    expect(() => readOdt(sansManifeste)).toThrowError(/manifeste/);
  });

  /**
   * `mimetype` doit rester la première entrée et non compressée : c'est ainsi
   * qu'un lecteur ODF identifie le paquet sans le décompresser.
   */
  it('replace mimetype en première position et sans compression', () => {
    const rebuilt = writeOdt(readOdt(buildOdt('<text:p>Bonjour</text:p>')));
    const entries = Object.keys(unzipSync(rebuilt));
    expect(entries[0]).toBe('mimetype');
    // Repérable dans l'archive en clair puisqu'il n'est pas compressé.
    expect(strFromU8(rebuilt).includes(ODT_MIME)).toBe(true);
  });
});

describe('repères coupés par des balises', () => {
  /**
   * LibreOffice découpe un paragraphe dès qu'un attribut change ; un repère peut
   * donc arriver scindé au milieu, et aucune substitution naïve ne le verrait.
   */
  it('recolle un repère scindé par un span', () => {
    const xml = '<text:p>{{nom<text:span>Complet}}</text:span></text:p>';
    expect(findPlaceholders(xml)).toEqual(['nomComplet']);
    expect(mendPlaceholders(xml)).toContain('{{nomComplet}}');
  });

  it('recolle un repère scindé en trois', () => {
    const xml = '<text:p>{{ni<text:span>ve</text:span><text:span>au}}</text:span></text:p>';
    expect(findPlaceholders(xml)).toEqual(['niveau']);
  });

  /**
   * Recoller par-dessus une fin de paragraphe fusionnerait deux paragraphes.
   * Mieux vaut que le repère ressorte non résolu que déformer le document.
   */
  it('laisse tel quel un repère qui enjambe deux paragraphes', () => {
    const xml = '<text:p>{{nom</text:p><text:p>Complet}}</text:p>';
    expect(findPlaceholders(xml)).toEqual([]);
    expect(mendPlaceholders(xml)).toBe(xml);
  });

  it('tolère les espaces internes', () => {
    expect(findPlaceholders('<text:p>{{ niveau }}</text:p>')).toEqual(['niveau']);
  });

  it('ne prend pas une accolade simple pour un repère', () => {
    expect(findPlaceholders('<text:p>{niveau} et {{}}</text:p>')).toEqual([]);
  });
});

describe('substitution', () => {
  it('remplace les repères connus', () => {
    const { xml, unresolved } = fillXml('<text:p>{{nom}} — {{niveau}}</text:p>', {
      nom: 'BENALI',
      niveau: 'B1.2',
    });
    expect(xml).toBe('<text:p>BENALI — B1.2</text:p>');
    expect(unresolved).toEqual([]);
  });

  /**
   * Effacer un repère sans valeur donnerait une attestation amputée sans que
   * personne ne s'en aperçoive : il reste visible ET signalé.
   */
  it('laisse visible et signale un repère sans valeur', () => {
    const { xml, unresolved } = fillXml('<text:p>{{nom}} {{inconnu}}</text:p>', { nom: 'BENALI' });
    expect(xml).toContain('{{inconnu}}');
    expect(unresolved).toEqual(['inconnu']);
  });

  it('échappe ce qui casserait le XML', () => {
    expect(escapeXml('Ben & Ali <fils>')).toBe('Ben &amp; Ali &lt;fils&gt;');
    const { xml } = fillXml('<text:p>{{nom}}</text:p>', { nom: 'Ben & Ali' });
    expect(xml).toBe('<text:p>Ben &amp; Ali</text:p>');
  });

  it('conserve un retour à la ligne comme retour à la ligne', () => {
    expect(escapeXml('Oran\nAlgérie')).toBe('Oran<text:line-break/>Algérie');
  });

  it('préserve l’arabe intact', () => {
    const { xml } = fillXml('<text:p>{{nom}}</text:p>', { nom: 'بوسهلة زكرياء' });
    expect(xml).toBe('<text:p>بوسهلة زكرياء</text:p>');
  });

  it('lit les repères de styles.xml comme ceux du corps', () => {
    const file = buildOdt(
      '<text:p>{{nom}}</text:p>',
      '<office:document-styles><style:header><text:p>{{sessionArabe}}</text:p></style:header></office:document-styles>',
    );
    expect(listTemplatePlaceholders(file).sort()).toEqual(['nom', 'sessionArabe']);
  });
});

describe('une page par destinataire', () => {
  it('répète le corps et insère un saut de page', () => {
    const repeated = repeatBody(contentXml('<text:p>{{nom}}</text:p>'), 3);
    expect(repeated.match(/\{\{nom\}\}/g)).toHaveLength(3);
    expect(repeated.match(/fo:break-before="page"/g)).toHaveLength(1); // le style, déclaré une fois
    expect(repeated.match(/CeilSautDePage"\/>/g)).toHaveLength(2); // deux sauts pour trois pages
  });

  it('ne répète pas les déclarations de séquences', () => {
    const declarations =
      '<text:sequence-decls><text:sequence-decl text:name="Illustration"/></text:sequence-decls>';
    const repeated = repeatBody(contentXml(`${declarations}<text:p>{{nom}}</text:p>`), 2);
    expect(repeated.match(/<text:sequence-decls>/g)).toHaveLength(1);
  });

  it('donne à chaque page les valeurs de SON destinataire', () => {
    const file = buildOdt('<text:p>{{nom}} — {{niveau}}</text:p>');
    const { file: filled, unresolved } = fillTemplateMany(file, [
      { nom: 'BENALI', niveau: 'B1.2' },
      { nom: 'ZEROUAL', niveau: 'A2.1' },
    ]);

    const body = bodyOf(filled);
    expect(body).toContain('BENALI — B1.2');
    expect(body).toContain('ZEROUAL — A2.1');
    // Aucune contamination entre les pages.
    expect(body).not.toContain('BENALI — A2.1');
    expect(unresolved).toEqual([]);
  });

  it('produit une seule page pour un seul destinataire, sans saut ajouté', () => {
    const filled = fillTemplate(buildOdt('<text:p>{{nom}}</text:p>'), { nom: 'BENALI' });
    const body = bodyOf(filled.file);
    expect(body).toContain('BENALI');
    expect(body).not.toContain('CeilSautDePage');
  });

  it('refuse de produire un document sans destinataire', () => {
    expect(() => fillTemplateMany(buildOdt('<text:p>x</text:p>'), [])).toThrowError(/destinataire/);
  });

  it('remonte les repères non résolus de toutes les pages', () => {
    const file = buildOdt('<text:p>{{nom}} {{oubli}}</text:p>');
    const { unresolved } = fillTemplateMany(file, [{ nom: 'A' }, { nom: 'B' }]);
    expect(unresolved).toEqual(['oubli']);
  });
});

/**
 * Le gabarit de départ distribué aux utilisateurs est relu par le code qui le
 * remplira : s'il cessait d'être exploitable — parce qu'un repère a été renommé
 * sans relancer `npm run docs:attestation` — l'échec tombe ici, pas au moment
 * d'imprimer une attestation officielle.
 */
describe('gabarit docs/modele-attestation.odt', () => {
  const file = new Uint8Array(readFileSync(resolve(process.cwd(), 'docs/modele-attestation.odt')));

  it('est une archive ODT valide', () => {
    const entries = Object.keys(readOdt(file));
    expect(entries).toContain('META-INF/manifest.xml');
    expect(entries).toContain('styles.xml');
  });

  it('est en A4 paysage', () => {
    const styles = strFromU8(readOdt(file)['styles.xml']!);
    expect(styles).toContain('fo:page-width="29.7cm"');
    expect(styles).toContain('fo:page-height="21cm"');
    expect(styles).toContain('style:print-orientation="landscape"');
  });

  it('n’utilise que des repères que l’application sait remplir', () => {
    expect(unknownPlaceholders(file)).toEqual([]);
  });

  it('se remplit intégralement avec le catalogue', () => {
    const values = Object.fromEntries(
      CERTIFICATE_PLACEHOLDERS.map((entry) => [entry.name, `«${entry.name}»`]),
    );
    const { unresolved } = fillTemplate(file, values);
    expect(unresolved).toEqual([]);
  });
});
