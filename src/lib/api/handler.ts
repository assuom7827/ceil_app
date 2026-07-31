/**
 * Wrapper UNIQUE des Route Handlers.
 *
 * Il porte trois responsabilités qu'aucun handler ne doit réimplémenter :
 *   1. résoudre l'utilisateur courant et refuser les anonymes (401) ;
 *   2. vérifier le droit d'accès à la ressource (403) ;
 *   3. traduire toute exception en réponse `{ error, message, details? }`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertCanRead, assertCanWrite, type Actor, type Resource } from '@/services/rbac';
import { validationError } from '@/services/errors';
import { toErrorResponse } from './errors';

export interface HandlerContext<TParams> {
  request: NextRequest;
  params: TParams;
  actor: Actor;
  url: URL;
  db: typeof prisma;
}

export interface RouteOptions {
  /** Ressource visée, pour la vérification RBAC. */
  resource: Resource;
  /** `read` pour les GET, `write` pour toute modification. */
  access: 'read' | 'write';
  /** Route ouverte aux anonymes (aucune aujourd'hui hors sonde de santé). */
  public?: boolean;
}

/** Récupère l'acteur courant, ou `null` si la session est absente/inactive. */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role };
}

type NextRouteParams<TParams> = { params: Promise<TParams> };

/**
 * Construit un Route Handler Next à partir d'une fonction métier.
 * La valeur retournée est sérialisée en JSON ; renvoyer une `Response`
 * permet de maîtriser le statut ou le type de contenu (fichiers, PDF).
 */
export function route<TParams = Record<string, never>>(
  options: RouteOptions,
  handler: (context: HandlerContext<TParams>) => Promise<unknown>,
) {
  return async (request: NextRequest, segment: NextRouteParams<TParams>): Promise<Response> => {
    try {
      const actor = await currentActor();

      if (options.access === 'read') assertCanRead(actor, options.resource);
      else assertCanWrite(actor, options.resource);

      // `assertCanRead/Write` a déjà levé un 401 si `actor` est nul.
      const result = await handler({
        request,
        params: await segment.params,
        actor: actor as Actor,
        url: new URL(request.url),
        db: prisma,
      });

      if (result instanceof Response) return result;
      if (result === undefined) return new NextResponse(null, { status: 204 });
      return NextResponse.json(result);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Lit et valide un corps JSON. Un corps absent ou illisible est un 400. */
export async function readJson<T>(
  request: NextRequest,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw validationError('Corps de requête JSON attendu.');
  }
  return schema.parse(payload);
}

/**
 * Lit un fichier envoyé en `multipart/form-data` sous le champ `file`.
 * Utilisé par les imports Excel/CSV.
 */
export async function readUploadedFile(request: NextRequest, field = 'file'): Promise<Uint8Array> {
  return (await readUpload(request, field)).bytes;
}

/**
 * Comme `readUploadedFile`, mais rend aussi le **nom d'origine** : un gabarit
 * téléversé doit pouvoir être retrouvé et retéléchargé par l'administration
 * sous le nom qu'elle lui a donné.
 */
export async function readUpload(
  request: NextRequest,
  field = 'file',
): Promise<{ bytes: Uint8Array; fileName: string }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw validationError('Fichier attendu (multipart/form-data).');
  }

  const file = form.get(field);
  if (!(file instanceof File)) {
    throw validationError(`Champ « ${field} » manquant ou invalide.`);
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name };
}
