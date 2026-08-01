import { NextResponse } from 'next/server';
import { route } from '@/lib/api/handler';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const POST = route<{ id: string }>(
  { resource: 'DiplomaModel', access: 'write' },
  async ({ db, params, request }) => {
    const model = await db.diplomaModel.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!model) {
      throw new Error('Modèle de diplôme introuvable.');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string;

    if (!file || !type) {
      throw new Error('Fichier et type requis.');
    }

    if (!['university', 'association'].includes(type)) {
      throw new Error('Type invalide.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error('Fichier vide.');
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error('Fichier trop volumineux (2 Mo maximum).');
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error('Format non supporté. Utilisez PNG, JPEG ou WebP.');
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const dir = join(process.cwd(), 'public', 'uploads', 'diploma-models', params.id);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const fileName = `${type}.${ext}`;
    const filePath = join(dir, fileName);
    writeFileSync(filePath, bytes);

    const url = `/uploads/diploma-models/${params.id}/${fileName}`;

    const field = type === 'university' ? 'universityLogo' : 'associationLogo';
    await db.diplomaModel.update({
      where: { id: params.id },
      data: { [field]: url },
    });

    return NextResponse.json({ url });
  },
);
