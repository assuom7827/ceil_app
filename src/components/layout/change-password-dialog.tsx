'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/app/(app)/actions';

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('userMenu');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    const result = await changePassword(formData);

    if (result.error) {
      setError(result.error);
    } else if (result.success) {
      setSuccess(result.success);
      onOpenChange(false);
      event.currentTarget.reset();
    }

    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changePassword')}</DialogTitle>
          <DialogDescription>{t('changePasswordDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('newPassword')}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={10}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">{t('passwordMinLength')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              disabled={pending}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? '...' : t('changePassword')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
