import type { DocumentHeader, DocumentPerson, GroupListDocument } from '@/services/documents';

/**
 * En-tête officiel, repris du `DiplomaModel` de la session.
 *
 * `heading` est du HTML bilingue saisi par l'administration : il est injecté
 * tel quel, ce qui est assumé — c'est un contenu de configuration, écrit par un
 * administrateur authentifié, pas une saisie d'utilisateur final.
 */
function OfficialHeader({ header }: { header: DocumentHeader }) {
  let headingHtml = header.model?.heading ?? null;

  if (headingHtml && header.model) {
    const universityLogo = header.model.universityLogo ?? '';
    const associationLogo = header.model.associationLogo ?? '';

    if (universityLogo) {
      headingHtml = headingHtml.replace(/\{\{universityLogo\}\}/g, universityLogo);
    }
    if (associationLogo) {
      headingHtml = headingHtml.replace(/\{\{associationLogo\}\}/g, associationLogo);
    }
  }

  if (headingHtml) {
    return (
      <header className="mb-8 space-y-3">
        <div
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: headingHtml }}
        />
        <hr className="border-black/40" />
      </header>
    );
  }

  return (
    <header className="mb-8 space-y-3">
      <div className="text-center text-sm">
        <p className="rtl-block text-center">الجمهورية الجزائرية الديمقراطية الشعبية</p>
        <p>Université Abdelhamid Ibn Badis — Mostaganem</p>
        <p>Centre d&apos;Enseignement Intensif des Langues</p>
      </div>
      <hr className="border-black/40" />
    </header>
  );
}

function SessionLine({ header, levelName }: { header: DocumentHeader; levelName?: string | null }) {
  return (
    <p className="text-center text-sm">
      {header.trainingFullName}
      {levelName ? ` — ${levelName}` : header.levelName ? ` — ${header.levelName}` : ''}
      {header.academicYear ? ` — ${header.academicYear}` : ''}
    </p>
  );
}

/** Lieu et date de délivrance, avec le mois de fin de session EN ARABE. */
function IssuePlace({ header }: { header: DocumentHeader }) {
  return (
    <div className="mt-12 flex items-start justify-between text-sm">
      <div className="rtl-block">
        <p>
          مستغانم في {header.arabicMonthTo ?? '—'} {header.yearTo ?? ''}
        </p>
        <p className="mt-16">المدير</p>
      </div>
      <div className="ltr-block text-end">
        <p>
          Mostaganem, {header.arabicMonthTo ?? '—'} {header.yearTo ?? ''}
        </p>
        <p className="mt-16">Le Directeur</p>
      </div>
    </div>
  );
}

/**
 * Pied de page du procès-verbal : seulement lieu et date en français.
 * Pas de mention de directeur — le PV est une trace de séance, pas un document
 * signé individuellement.
 */
function MinutesFooter({ header }: { header: DocumentHeader }) {
  return (
    <p className="mt-12 text-sm">
      Mostaganem, {header.frenchMonthTo ?? '—'} {header.yearTo ?? ''}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Diplôme — une feuille par admis
// ---------------------------------------------------------------------------

export function DiplomaSheet({
  header,
  person,
}: {
  header: DocumentHeader;
  person: DocumentPerson;
}) {
  return (
    <article className="print-sheet flex flex-col">
      <OfficialHeader header={header} />

      <h1 className="rtl-block mb-2 text-center text-3xl font-bold">شهادة نجاح</h1>
      <p className="mb-8 text-center text-2xl font-bold uppercase tracking-wide">Diplôme</p>

      <div className="flex-1 space-y-6">
        <div className="rtl-block space-y-2 text-base leading-loose">
          <p>يشهد مدير مركز التعليم المكثف للغات أن :</p>
          <p className="text-xl font-bold">{person.arabicFullName || person.fullName}</p>
          {person.arabicBirthPlace || person.birth ? (
            <p>
              المولود(ة) {person.birth ? `بتاريخ ${person.birth}` : ''}{' '}
              {person.arabicBirthPlace ? `بـ ${person.arabicBirthPlace}` : ''}
            </p>
          ) : null}
          <p>
            قد تابع(ت) بنجاح تكوين {header.trainingAr ?? header.trainingFr}
            {person.levelName ? ` — المستوى ${person.levelName}` : ''}
            {header.academicYear ? ` — السنة الجامعية ${header.academicYear}` : ''}
          </p>
        </div>

        <hr className="border-black/20" />

        <div className="ltr-block space-y-2 text-base leading-loose">
          <p>Le Directeur du Centre d’Enseignement Intensif des Langues atteste que :</p>
          <p className="text-xl font-bold">{person.fullName || person.arabicFullName}</p>
          {person.birth || person.birthPlace ? (
            <p>
              né(e) {person.birth ? `le ${person.birth}` : ''}
              {person.birthPlace ? ` à ${person.birthPlace}` : ''}
            </p>
          ) : null}
          <p>
            a suivi avec succès la formation en {header.trainingFr}
            {person.levelName ? ` — niveau ${person.levelName}` : ''}
            {header.academicYear ? ` — année universitaire ${header.academicYear}` : ''}.
          </p>
          <p className="text-sm text-black/70">
            Matricule : {person.registrationNumber} · Total : {person.total ?? '—'} / seuil{' '}
            {header.admissionThreshold}
          </p>
        </div>
      </div>

      <IssuePlace header={header} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Attestation — une feuille par inscrit
// ---------------------------------------------------------------------------

export function AttestationSheet({
  header,
  person,
}: {
  header: DocumentHeader;
  person: DocumentPerson;
}) {
  return (
    <article className="print-sheet flex flex-col">
      <OfficialHeader header={header} />

      <h1 className="rtl-block mb-2 text-center text-2xl font-bold">شهادة تسجيل</h1>
      <p className="mb-8 text-center text-xl font-bold uppercase tracking-wide">
        Attestation d’inscription
      </p>

      <div className="flex-1 space-y-6">
        <div className="rtl-block space-y-2 leading-loose">
          <p>يشهد المدير أن :</p>
          <p className="text-lg font-bold">{person.arabicFullName || person.fullName}</p>
          <p>
            مسجل(ة) في تكوين {header.trainingAr ?? header.trainingFr}
            {person.levelName ? ` — المستوى ${person.levelName}` : ''}
            {header.academicYear ? ` — السنة الجامعية ${header.academicYear}` : ''}
          </p>
        </div>

        <hr className="border-black/20" />

        <div className="ltr-block space-y-2 leading-loose">
          <p>Le Directeur atteste que :</p>
          <p className="text-lg font-bold">{person.fullName || person.arabicFullName}</p>
          <p>
            est régulièrement inscrit(e) à la formation en {header.trainingFr}
            {person.levelName ? ` — niveau ${person.levelName}` : ''}
            {header.academicYear ? ` — année universitaire ${header.academicYear}` : ''}.
          </p>
          <p className="text-sm text-black/70">
            Matricule d’inscription : {person.registrationNumber}
            {person.groupName ? ` · Groupe : ${person.groupName}` : ''}
          </p>
          <p className="text-sm text-black/70">
            Attestation délivrée pour servir et valoir ce que de droit.
          </p>
        </div>
      </div>

      <IssuePlace header={header} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Procès-verbal de délibération — tableau paginé
// ---------------------------------------------------------------------------

/** 22 lignes par feuille : au-delà, le tableau déborde d'une page A4. */
const ROWS_PER_SHEET = 22;

export function MinutesSheets({
  header,
  people,
}: {
  header: DocumentHeader;
  people: DocumentPerson[];
}) {
  const pages: DocumentPerson[][] = [];
  for (let index = 0; index < people.length; index += ROWS_PER_SHEET) {
    pages.push(people.slice(index, index + ROWS_PER_SHEET));
  }
  if (pages.length === 0) pages.push([]);

  const admitted = people.filter((person) => person.status === 'ADMITTED').length;
  const refused = people.filter((person) => person.status === 'REFUSED').length;
  const pending = people.filter((person) => person.status === null).length;

  const totals = people.filter((person) => person.total !== null);
  const minTotal = totals.length > 0 ? Math.min(...totals.map((p) => p.total!)) : null;
  const maxTotal = totals.length > 0 ? Math.max(...totals.map((p) => p.total!)) : null;

  const filteredLevel =
    people.length > 0 && people.every((p) => p.levelId === people[0]!.levelId)
      ? people[0]!.levelName
      : null;

  const distinctTeachers = [...new Set(people.map((p) => p.teacherName).filter(Boolean))];

  return (
    <>
      {pages.map((page, pageIndex) => (
        <article key={pageIndex} className="print-sheet flex flex-col">
          {pageIndex === 0 ? <OfficialHeader header={header} /> : null}

          <div className="mb-4 space-y-1 text-center">
            <h1 className="rtl-block text-center text-xl font-bold">محضر المداولة</h1>
            <p className="text-lg font-bold uppercase">Procès-verbal de délibération</p>
            <SessionLine header={header} levelName={filteredLevel} />
            <p className="text-xs text-black/60">
              Seuil d&apos;admission : {header.admissionThreshold} — page {pageIndex + 1} sur{' '}
              {pages.length}
            </p>
          </div>

          <table className="doc-table flex-1">
            <thead>
              <tr>
                <th style={{ width: '6%' }}>N°</th>
                <th style={{ width: '18%' }}>Matricule</th>
                <th>Nom et prénom</th>
                <th style={{ width: '8%' }}>E.O</th>
                <th style={{ width: '8%' }}>E.E</th>
                <th style={{ width: '8%' }}>C.O</th>
                <th style={{ width: '8%' }}>C.E</th>
                <th style={{ width: '9%' }}>Total</th>
                <th style={{ width: '12%' }}>Décision</th>
              </tr>
            </thead>
            <tbody>
              {page.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center">
                    Aucun inscrit.
                  </td>
                </tr>
              ) : (
                page.map((person, rowIndex) => (
                  <tr key={person.enrollmentId}>
                    <td className="text-center">{pageIndex * ROWS_PER_SHEET + rowIndex + 1}</td>
                    <td>{person.registrationNumber}</td>
                    <td>{person.fullName || person.arabicFullName}</td>
                    <td className="text-center">{person.scores.oralExpression ?? ''}</td>
                    <td className="text-center">{person.scores.writtenExpression ?? ''}</td>
                    <td className="text-center">{person.scores.oralComprehension ?? ''}</td>
                    <td className="text-center">{person.scores.writtenComprehension ?? ''}</td>
                    <td className="text-center font-semibold">{person.total ?? ''}</td>
                    <td className="text-center">
                      {person.status === 'ADMITTED'
                        ? 'Admis'
                        : person.status === 'REFUSED'
                          ? 'Ajourné'
                          : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {pageIndex === pages.length - 1 ? (
            <>
              <p className="mt-4 text-sm">
                Total : {people.length} inscrit(s) — <strong>{admitted}</strong> admis,{' '}
                <strong>{refused}</strong> ajourné(s)
                {pending > 0 ? `, ${pending} non délibéré(s)` : ''}
                {minTotal !== null && maxTotal !== null
                  ? ` Scores : ${minTotal}–${maxTotal} / ${header.admissionThreshold}.`
                  : ''}
              </p>

              {distinctTeachers.length > 0 ? (
                <div className="mt-8 border-t border-black/40 pt-4">
                  <p className="text-sm">
                    <strong>Enseignant(s) </strong>
                    {filteredLevel ? `intervenant(s) au niveau ${filteredLevel}` : ''} :
                  </p>
                  <div className="mt-2 space-y-3">
                    {distinctTeachers.map((teacher, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{teacher}</span>
                        <span className="text-xs italic">_________________________</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <MinutesFooter header={header} />
            </>
          ) : null}
        </article>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Liste d'émargement
// ---------------------------------------------------------------------------

const LIST_ROWS_PER_SHEET = 20;

export function GroupListSheets({ header, people, group }: GroupListDocument) {
  const pages: DocumentPerson[][] = [];
  for (let index = 0; index < people.length; index += LIST_ROWS_PER_SHEET) {
    pages.push(people.slice(index, index + LIST_ROWS_PER_SHEET));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <>
      {pages.map((page, pageIndex) => (
        <article key={pageIndex} className="print-sheet flex flex-col">
          {pageIndex === 0 ? <OfficialHeader header={header} /> : null}

          <div className="mb-4 space-y-1 text-center">
            <h1 className="rtl-block text-center text-xl font-bold">قائمة المشاركين</h1>
            <p className="text-lg font-bold uppercase">Liste des participants</p>
            <SessionLine header={header} />
            <p className="text-sm font-medium">
              {group
                ? `Groupe : ${group.name}${group.levelName ? ` — ${group.levelName}` : ''}`
                : 'Tous les inscrits de la session'}
            </p>
            <p className="text-xs text-black/60">
              {people.length} participant(s) — page {pageIndex + 1} sur {pages.length}
            </p>
          </div>

          <table className="doc-table flex-1">
            <thead>
              <tr>
                <th style={{ width: '6%' }}>N°</th>
                <th style={{ width: '20%' }}>Matricule</th>
                <th>Nom et prénom</th>
                <th style={{ width: '18%' }}>الاسم واللقب</th>
                <th style={{ width: '10%' }}>Niveau</th>
                <th style={{ width: '20%' }}>Émargement</th>
              </tr>
            </thead>
            <tbody>
              {page.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    Aucun participant dans ce périmètre.
                  </td>
                </tr>
              ) : (
                page.map((person, rowIndex) => (
                  <tr key={person.enrollmentId}>
                    <td className="text-center">
                      {pageIndex * LIST_ROWS_PER_SHEET + rowIndex + 1}
                    </td>
                    <td>{person.registrationNumber}</td>
                    <td>{person.fullName}</td>
                    <td className="rtl-block">{person.arabicFullName}</td>
                    <td className="text-center">{person.levelName ?? '—'}</td>
                    {/* Colonne volontairement vide : signature manuscrite. */}
                    <td />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      ))}
    </>
  );
}
