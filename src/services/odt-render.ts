/**
 * Conversion ODT → PDF par LibreOffice.
 *
 * C'est la SEULE dépendance système de l'application, et elle est confinée ici.
 * Elle est assumée : convertir soi-même un ODT en PDF fidèle supposerait
 * réimplémenter la mise en page de LibreOffice, alors que le gabarit est
 * précisément conçu dans LibreOffice.
 *
 * Voir `docs/exploitation.md` pour l'installation, et `docs/decisions.md` (D-26)
 * pour l'alternative écartée.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { dependencyError, ServiceError } from './errors';

const run = promisify(execFile);

/** Binaire LibreOffice ; surchargeable pour un déploiement non standard. */
const SOFFICE = process.env.SOFFICE_PATH ?? 'soffice';

/** Au-delà, la conversion est considérée bloquée plutôt que lente. */
const TIMEOUT_MS = Number(process.env.SOFFICE_TIMEOUT_MS ?? 120_000);

/**
 * Arguments communs.
 *
 * Le profil utilisateur est PROPRE à chaque appel : deux invocations qui
 * partagent un profil se bloquent mutuellement, et LibreOffice se contente
 * alors de rendre la main sans rien convertir — un symptôme muet.
 */
const BASE_ARGS = (workDir: string): string[] => [
  '--headless',
  '--norestore',
  '--invisible',
  `-env:UserInstallation=file://${join(workDir, 'profil')}`,
];

/**
 * Convertit un ODT en PDF.
 *
 * Chaque conversion reçoit son **propre profil utilisateur** LibreOffice : deux
 * conversions simultanées partageant un profil se bloquent mutuellement, et le
 * symptôme — une requête qui n'aboutit jamais — est particulièrement pénible à
 * diagnostiquer en production.
 */
export async function odtToPdf(odt: Uint8Array): Promise<Uint8Array> {
  const workDir = await mkdtemp(join(tmpdir(), 'ceil-odt-'));
  const source = join(workDir, 'document.odt');
  const output = join(workDir, 'document.pdf');

  try {
    await writeFile(source, odt);
    await convert(source, workDir);

    try {
      return new Uint8Array(await readFile(output));
    } catch {
      // LibreOffice a rendu la main sans écrire : cas typique d'une instance
      // déjà lancée qui absorbe la commande. Ne pas confondre avec un binaire
      // absent — le diagnostic serait envoyé au mauvais endroit.
      throw dependencyError(
        'LibreOffice n’a produit aucun PDF. Vérifiez qu’aucune autre instance de LibreOffice ne tourne sur le serveur.',
        { reason: 'no-output' },
      );
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Lance la conversion, en traduisant les échecs de lancement. */
async function convert(source: string, outDir: string): Promise<void> {
  try {
    await run(SOFFICE, [...BASE_ARGS(outDir), '--convert-to', 'pdf', '--outdir', outDir, source], {
      timeout: TIMEOUT_MS,
      windowsHide: true,
    });
  } catch (caught) {
    if (caught instanceof ServiceError) throw caught;
    throw conversionError(caught);
  }
}

/** Traduit un échec de conversion en erreur de service lisible. */
function conversionError(caught: unknown): Error {
  const code = (caught as { code?: string | number } | null)?.code;

  if (code === 'ENOENT') {
    return dependencyError(
      'LibreOffice est introuvable sur le serveur : la conversion des attestations en PDF est impossible. Installez `libreoffice-writer` (voir docs/exploitation.md).',
      { reason: 'missing', binary: SOFFICE },
    );
  }
  if (code === 'ETIMEDOUT') {
    return dependencyError(
      'La conversion PDF a dépassé le temps imparti. Réessayez, ou éditez les attestations par lots plus petits.',
      { reason: 'timeout', timeoutMs: TIMEOUT_MS },
    );
  }
  return dependencyError(
    'LibreOffice n’a pas pu convertir le gabarit. Vérifiez qu’il s’ouvre correctement dans LibreOffice Writer.',
    { reason: 'failed', cause: caught instanceof Error ? caught.message : String(caught) },
  );
}

/** LibreOffice répond-il ? Utilisé par le diagnostic d'exploitation. */
export async function libreOfficeVersion(): Promise<string | null> {
  const workDir = await mkdtemp(join(tmpdir(), 'ceil-lo-'));
  try {
    const { stdout } = await run(SOFFICE, [...BASE_ARGS(workDir), '--version'], {
      timeout: 30_000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
