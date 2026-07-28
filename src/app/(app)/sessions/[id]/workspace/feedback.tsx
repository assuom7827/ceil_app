'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export type FeedbackKind = 'success' | 'error';

export interface Feedback {
  kind: FeedbackKind;
  message: string;
}

/**
 * Retour d'action mutualisé par les onglets : l'utilisateur voit toujours si
 * l'opération a réussi, et le message d'erreur du serveur est affiché tel quel
 * plutôt que remplacé par un message générique.
 */
export function useAction() {
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);

  const run = React.useCallback(async (action: () => Promise<string | void>): Promise<boolean> => {
    setPending(true);
    setFeedback(null);
    try {
      const message = await action();
      if (message) setFeedback({ kind: 'success', message });
      return true;
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.',
      });
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, feedback, setFeedback, run };
}

export function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;

  return (
    <p
      role="status"
      data-testid={`feedback-${feedback.kind}`}
      className={cn(
        'flex items-center gap-2 rounded-md p-3 text-sm',
        feedback.kind === 'success'
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {feedback.kind === 'success' ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : (
        <AlertTriangle className="size-4 shrink-0" />
      )}
      {feedback.message}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />;
}
