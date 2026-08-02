import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Vérification d\'attestation',
    description: 'Vérifiez l\'authenticité d\'une attestation d\'inscription.',
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

  let data: { valid: boolean; attestation: { sessionTitle: string; academicYear: string; student: { fullName: string; arabicFullName: string; registrationNumber: string; level: string | null; group: string | null; status: string | null; }; }; } | null = null;
  let error = false;

  try {
    const res = await fetch(apiUrl, { next: { revalidate: 0 } });
    if (res.ok) {
      data = await res.json();
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-6">
        <h1 className="mb-4 text-center text-2xl font-bold">Vérification d&apos;attestation</h1>

        {error ? (
          <div className="rounded-md bg-destructive/10 p-4 text-center text-destructive">
            Attestation introuvable ou invalide.
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 text-center text-green-700 dark:bg-green-950 dark:text-green-300">
              Attestation valide
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Session:</span> {data.attestation.sessionTitle}
              </div>
              <div>
                <span className="font-semibold">Année universitaire:</span> {data.attestation.academicYear}
              </div>
              <div>
                <span className="font-semibold">Nom:</span> {data.attestation.student.fullName}
              </div>
              <div>
                <span className="font-semibold">الاسم:</span> {data.attestation.student.arabicFullName}
              </div>
              <div>
                <span className="font-semibold">Matricule:</span> {data.attestation.student.registrationNumber}
              </div>
              {data.attestation.student.level && (
                <div>
                  <span className="font-semibold">Niveau:</span> {data.attestation.student.level}
                </div>
              )}
              {data.attestation.student.group && (
                <div>
                  <span className="font-semibold">Groupe:</span> {data.attestation.student.group}
                </div>
              )}
              {data.attestation.student.status && (
                <div>
                  <span className="font-semibold">Statut:</span> {data.attestation.student.status}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(apiUrl)}`}
              alt="QR Code de vérification"
              className="rounded"
            />
          </div>
        )}
      </div>
    </div>
  );
}
