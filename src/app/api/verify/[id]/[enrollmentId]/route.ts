import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAttestationDocument } from '@/services/documents';
import { getTranslations } from 'next-intl/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  const t = await getTranslations();
  const { id, enrollmentId } = await context.params;

  try {
    const { header, people } = await getAttestationDocument(prisma, id, enrollmentId);
    const person = people[0];

    if (!person) {
      return NextResponse.json({ error: t('notFound') }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const verificationUrl = `${baseUrl}/verify/${id}/${enrollmentId}`;

    return NextResponse.json({
      valid: true,
      verifiedAt: new Date().toISOString(),
      attestation: {
        sessionTitle: header.sessionTitle,
        academicYear: header.academicYear,
        student: {
          fullName: person.fullName,
          arabicFullName: person.arabicFullName,
          registrationNumber: person.registrationNumber,
          level: person.levelName,
          group: person.groupName,
          status: person.status,
        },
        verificationUrl,
      },
    });
  } catch {
    return NextResponse.json(
      { error: t('notFound') },
      { status: 404 }
    );
  }
}
