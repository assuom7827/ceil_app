'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface LogoUploadProps {
  modelId: string;
  type: 'university' | 'association';
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
}

export function LogoUpload({ modelId, type, currentUrl, onUploaded, onRemoved }: LogoUploadProps) {
  const t = useTranslations();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('type', type);

      const response = await fetch(`/api/diploma-models/${modelId}/logos`, {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { message?: string }).message || t('templateControl.uploadImpossible'));
      }

      const result = await response.json() as { url: string };
      onUploaded(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('templateControl.uploadImpossible'));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <div className="flex items-center gap-2">
        {currentUrl ? (
          <>
            <img src={currentUrl} alt="" className="h-12 w-auto object-contain border rounded" />
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
              {t('templateControl.replace')}
            </Button>
            {onRemoved && (
              <Button type="button" size="sm" variant="ghost" onClick={onRemoved} disabled={pending} className="text-destructive">
                {t('templateControl.removeAria').replace('Retirer le gabarit', 'Supprimer')}
              </Button>
            )}
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
            {t('templateControl.upload')}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
