import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('qrCode.verify'),
    description: t('qrCode.verifyDescription'),
  };
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ id: string; enrollmentId: string }>;
}) {
  const { id, enrollmentId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/verify/${id}/${enrollmentId}`;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-6">
        <h1 className="mb-4 text-center text-2xl font-bold">Vérification d&apos;attestation</h1>
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Cette page vérifie l&apos;authenticité d&apos;une attestation d&apos;inscription.
        </p>
        <div className="flex justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(apiUrl)}`}
            alt="QR Code de vérification"
            className="rounded"
          />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Scannez ce QR code pour vérifier l&apos;attestation en ligne.
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          URL: {apiUrl}
        </p>
      </div>
    </div>
  );
}
