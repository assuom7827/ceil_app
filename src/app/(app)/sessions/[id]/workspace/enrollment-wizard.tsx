'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { ALLOWED_TRANSITIONS, type EnrollmentStatusLike } from '@/services/enrollmentStatus';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import type { EnrollmentRow } from './types';

interface ParticipantDetail {
  id: string;
  familyName: string | null;
  firstName: string | null;
  arabName: string | null;
  arabFirstName: string | null;
  registrationNumber: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  arabBirthPlace: string | null;
  birthDateIsApproximate: boolean;
  approximateBirth: string | null;
  gender: 'WOMAN' | 'MAN' | null;
  note: string | null;
  type: 'STUDENT' | 'TEACHER';
}

interface PaymentReceiptSummary {
  id: string;
  state: 'DRAFT' | 'CONFIRMED';
  paymentDate: string | null;
  amount: number;
  memo: string | null;
  participantId: string;
  trainingSessionId: string | null;
}

interface ParticipantDraft {
  familyName: string;
  firstName: string;
  arabName: string;
  arabFirstName: string;
  birthDate: string;
  birthPlace: string;
  arabBirthPlace: string;
  birthDateIsApproximate: boolean;
  approximateBirth: string;
  gender: string;
  phone: string;
  email: string;
  note: string;
}

function toParticipantDraft(p: ParticipantDetail): ParticipantDraft {
  return {
    familyName: p.familyName ?? '',
    firstName: p.firstName ?? '',
    arabName: p.arabName ?? '',
    arabFirstName: p.arabFirstName ?? '',
    birthDate: p.birthDate
      ? new Date(p.birthDate).toISOString().split('T')[0] ?? ''
      : '',
    birthPlace: p.birthPlace ?? '',
    arabBirthPlace: p.arabBirthPlace ?? '',
    birthDateIsApproximate: p.birthDateIsApproximate ?? false,
    approximateBirth: p.approximateBirth ?? '',
    gender: p.gender ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    note: p.note ?? '',
  };
}

function toISOString(dateString: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function statusLabel(status: EnrollmentStatusLike, t: (key: string) => string): string {
  return t(`enrollmentsTab.status${capitalize(status)}`);
}

export function EnrollmentWizard({
  enrollment,
  sessionId,
  open,
  onOpenChange,
  onSaved,
}: {
  enrollment: EnrollmentRow;
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations();
  const { pending, feedback, run } = useAction();

  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState(1);

  const [participant, setParticipant] = React.useState<ParticipantDetail | null>(null);
  const [participantDraft, setParticipantDraft] = React.useState<ParticipantDraft>({
    familyName: '',
    firstName: '',
    arabName: '',
    arabFirstName: '',
    birthDate: '',
    birthPlace: '',
    arabBirthPlace: '',
    birthDateIsApproximate: false,
    approximateBirth: '',
    gender: '',
    phone: '',
    email: '',
    note: '',
  });

  const [receipts, setReceipts] = React.useState<PaymentReceiptSummary[]>([]);
  const [paymentReceived, setPaymentReceived] = React.useState(false);
  const [paymentDate, setPaymentDate] = React.useState('');
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [memo, setMemo] = React.useState('');
  const [statusTarget, setStatusTarget] = React.useState('');

  const paymentConfirmed = receipts.some((r) => r.state === 'CONFIRMED');

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setPaymentReceived(false);
    setStatusTarget('');
    setMemo('');
    setPaymentDate('');
    setPaymentAmount('');
    setLoading(true);

    Promise.all([
      apiGet<ParticipantDetail>(`/api/participants/${enrollment.participant.id}`),
      apiGet<{ data: PaymentReceiptSummary[]; meta: unknown }>(
        `/api/payment-receipts?perPage=200`,
      ),
    ])
      .then(([participantData, receiptsData]) => {
        setParticipant(participantData);
        setParticipantDraft(toParticipantDraft(participantData));
        const participantReceipts = receiptsData.data.filter(
          (r) =>
            r.participantId === enrollment.participant.id &&
            r.trainingSessionId === sessionId,
        );
        setReceipts(participantReceipts);
      })
      .finally(() => setLoading(false));
  }, [open, enrollment.participant.id, sessionId]);

  function derivePaymentTarget(
    current: EnrollmentStatusLike,
  ): EnrollmentStatusLike | null {
    if (current === 'PENDING') return 'CONFIRMED';
    if (current === 'CONFIRMED') return 'ACTIVE';
    return null;
  }

  const allowedTransitions = React.useMemo(() => {
    return ALLOWED_TRANSITIONS[enrollment.status as EnrollmentStatusLike] ?? [];
  }, [enrollment.status]);

  const currentStatusLabel = statusLabel(enrollment.status as EnrollmentStatusLike, t);

  const showPaymentSection = !paymentConfirmed;

  function hasParticipantChanges(): boolean {
    if (!participant) return false;
    const original = toParticipantDraft(participant);
    return Object.keys(participantDraft).some((k) => {
      const key = k as keyof ParticipantDraft;
      return JSON.stringify(original[key]) !== JSON.stringify(participantDraft[key]);
    });
  }

  function hasStatusChanges(): boolean {
    return paymentReceived || statusTarget !== '';
  }

  async function save() {
    if (!participant) return;

    await run(async () => {
      const changes: Array<{
        call: () => Promise<unknown>;
        rollback: () => Promise<void>;
      }> = [];

      if (hasParticipantChanges()) {
        const original = toParticipantDraft(participant);
        changes.push({
          call: () =>
            apiPatch(`/api/participants/${participant.id}`, {
              familyName: participantDraft.familyName || undefined,
              firstName: participantDraft.firstName || undefined,
              arabName: participantDraft.arabName || undefined,
              arabFirstName: participantDraft.arabFirstName || undefined,
              birthDate: toISOString(participantDraft.birthDate),
              birthPlace: participantDraft.birthPlace || null,
              arabBirthPlace: participantDraft.arabBirthPlace || null,
              birthDateIsApproximate: participantDraft.birthDateIsApproximate,
              approximateBirth: participantDraft.approximateBirth || null,
              gender: (participantDraft.gender as 'WOMAN' | 'MAN') || null,
              phone: participantDraft.phone || null,
              email: participantDraft.email || null,
              note: participantDraft.note || null,
            }),
          rollback: () =>
            apiPatch(`/api/participants/${participant.id}`, {
              familyName: original.familyName || null,
              firstName: original.firstName || null,
              arabName: original.arabName || null,
              arabFirstName: original.arabFirstName || null,
              birthDate: original.birthDate,
              birthPlace: original.birthPlace,
              arabBirthPlace: original.arabBirthPlace,
              birthDateIsApproximate: original.birthDateIsApproximate,
              approximateBirth: original.approximateBirth,
              gender: original.gender,
              phone: original.phone,
              email: original.email,
              note: original.note,
            }),
        });
      }

      const targetStatus = paymentReceived
        ? derivePaymentTarget(enrollment.status as EnrollmentStatusLike)
        : statusTarget || null;

      let createdReceiptId: string | null = null;

      if (paymentReceived && targetStatus) {
        changes.push({
          call: async () => {
            const receipt = await apiPost<{ id: string }>(`/api/payment-receipts`, {
              participantId: enrollment.participant.id,
              trainingSessionId: sessionId,
              paymentDate: toISOString(paymentDate) ?? new Date().toISOString(),
              amount: Number(paymentAmount) || 0,
              memo: memo || null,
            });
            createdReceiptId = receipt.id;
            await apiPost(`/api/payment-receipts/${receipt.id}/confirm`, {});
          },
          rollback: () =>
            createdReceiptId
              ? apiDelete(`/api/payment-receipts/${createdReceiptId}`)
              : Promise.resolve(),
        });
      }

      if (targetStatus && targetStatus !== enrollment.status) {
        changes.push({
          call: () =>
            apiPost(`/api/enrollments/${enrollment.id}/status`, {
              status: targetStatus,
              reason: memo || undefined,
            }),
          rollback: () =>
            apiPost(`/api/enrollments/${enrollment.id}/status`, {
              status: enrollment.status,
              reason: undefined,
            }),
        });
      }

      if (changes.length === 0) {
        onOpenChange(false);
        return t('enrollmentsTab.noChanges');
      }

      const executed: Array<() => Promise<void>> = [];

      try {
        for (const change of changes) {
          await change.call();
          executed.push(change.rollback);
        }
      } catch (error) {
        for (let i = executed.length - 1; i >= 0; i--) {
          const rollback = executed[i];
          if (rollback) {
            try {
              await rollback();
            } catch {
              // rollback best-effort
            }
          }
        }
        throw error;
      }

      onSaved();
      return t('enrollmentsTab.wizardSaved');
    });

    onOpenChange(false);
  }

  function canProceed(): boolean {
    if (showPaymentSection && paymentReceived && !paymentAmount) return false;
    return hasStatusChanges() || hasParticipantChanges();
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('enrollmentsTab.wizardTitle')}</DialogTitle>
          <DialogDescription>{t('enrollmentsTab.wizardDescription')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Spinner /> {t('enrollmentsTab.loading')}
          </p>
        ) : participant ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              {step === 1 ? (
                <Badge>{t('enrollmentsTab.wizardStep1')}</Badge>
              ) : (
                <Badge variant="outline">{t('enrollmentsTab.wizardStep1')}</Badge>
              )}
              {step === 2 ? (
                <Badge>{t('enrollmentsTab.wizardStep2')}</Badge>
              ) : (
                <Badge variant="outline">{t('enrollmentsTab.wizardStep2')}</Badge>
              )}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('enrollmentsTab.colStatus')}:
                  </span>
                  <Badge>{currentStatusLabel}</Badge>
                </div>

                {paymentConfirmed && (
                  <div className="flex items-center gap-2 rounded-md bg-success/10 p-2 text-sm text-success">
                    <Badge variant="success">{t('enrollmentsTab.paymentConfirmed')}</Badge>
                    {t('enrollmentsTab.paymentAlreadyRecorded')}
                  </div>
                )}

                {showPaymentSection && (
                  <div className="space-y-3 rounded-md border p-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={paymentReceived}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setPaymentReceived(next);
                          if (next) {
                            const target = derivePaymentTarget(
                              enrollment.status as EnrollmentStatusLike,
                            );
                            if (target) setStatusTarget(target);
                          } else {
                            setStatusTarget('');
                          }
                        }}
                      />
                      {t('enrollmentsTab.paymentReceived')}
                    </Label>

                    {paymentReceived && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="payment-date" className="text-xs">
                            {t('enrollmentsTab.paymentDate')}
                          </Label>
                          <Input
                            id="payment-date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="payment-amount" className="text-xs">
                            {t('enrollmentsTab.paymentAmount')}
                          </Label>
                          <Input
                            id="payment-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">
                    {t('enrollmentsTab.workflowTransition')}
                  </Label>
                  <select
                    value={statusTarget}
                    onChange={(e) => {
                      setStatusTarget(e.target.value);
                      setPaymentReceived(false);
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    disabled={paymentReceived || paymentConfirmed}
                  >
                    <option value="">{t('enrollmentsTab.transitionPlaceholder')}</option>
                    {allowedTransitions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="status-memo" className="text-sm font-medium">
                    {t('enrollmentsTab.statusReason')}
                  </Label>
                  <Input
                    id="status-memo"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder={t('enrollmentsTab.reasonPlaceholder')}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <Label className="text-sm font-medium">
                  {t('enrollmentsTab.participantInfo')}
                </Label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="family-name" className="text-xs">
                      {t('enrollmentsTab.familyName')}
                    </Label>
                    <Input
                      id="family-name"
                      value={participantDraft.familyName}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, familyName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="first-name" className="text-xs">
                      {t('enrollmentsTab.firstName')}
                    </Label>
                    <Input
                      id="first-name"
                      value={participantDraft.firstName}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, firstName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="arab-name" className="text-xs">
                      {t('enrollmentsTab.arabName')}
                    </Label>
                    <Input
                      id="arab-name"
                      value={participantDraft.arabName}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, arabName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="arab-first-name" className="text-xs">
                      {t('enrollmentsTab.arabFirstName')}
                    </Label>
                    <Input
                      id="arab-first-name"
                      value={participantDraft.arabFirstName}
                      onChange={(e) =>
                        setParticipantDraft({
                          ...participantDraft,
                          arabFirstName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth-date" className="text-xs">
                      {t('enrollmentsTab.birthDate')}
                    </Label>
                    <Input
                      id="birth-date"
                      type="date"
                      value={participantDraft.birthDate}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, birthDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth-place" className="text-xs">
                      {t('enrollmentsTab.birthPlace')}
                    </Label>
                    <Input
                      id="birth-place"
                      value={participantDraft.birthPlace}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, birthPlace: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="arab-birth-place" className="text-xs">
                      {t('enrollmentsTab.arabBirthPlace')}
                    </Label>
                    <Input
                      id="arab-birth-place"
                      value={participantDraft.arabBirthPlace}
                      onChange={(e) =>
                        setParticipantDraft({
                          ...participantDraft,
                          arabBirthPlace: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-xs">
                      {t('enrollmentsTab.email')}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={participantDraft.email}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-xs">
                      {t('enrollmentsTab.phone')}
                    </Label>
                    <Input
                      id="phone"
                      value={participantDraft.phone}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="note" className="text-xs">
                      {t('enrollmentsTab.note')}
                    </Label>
                    <Input
                      id="note"
                      value={participantDraft.note}
                      onChange={(e) =>
                        setParticipantDraft({ ...participantDraft, note: e.target.value })
                      }
                      placeholder={t('enrollmentsTab.notePlaceholder')}
                    />
                  </div>
                </div>
              </div>
            )}

            <FeedbackBanner feedback={feedback} />

            <DialogFooter>
              <div className="flex gap-2">
                {step > 1 ? (
                  <Button variant="outline" onClick={() => setStep(1)} disabled={pending}>
                    {t('enrollmentsTab.wizardBack')}
                  </Button>
                ) : null}
                {step === 1 ? (
                  <Button onClick={() => setStep(2)} disabled={pending}>
                    {t('enrollmentsTab.wizardNext')}
                  </Button>
                ) : (
                  <Button onClick={save} disabled={pending || !canProceed()}>
                    {pending ? <Spinner /> : <Save />}
                    {t('enrollmentsTab.wizardSave')}
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                  {t('enrollmentsTab.wizardCancel')}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
