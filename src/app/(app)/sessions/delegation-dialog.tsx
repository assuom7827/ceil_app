'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiPost } from '@/lib/api/client';
import { formatDate } from '@/lib/date-format';
import type { SessionAgentInfo } from '@/services/delegation';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function DelegationDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [agents, setAgents] = React.useState<SessionAgentInfo[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  const loadAgents = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SessionAgentInfo[]>(`/api/sessions/${sessionId}/agents`);
      setAgents(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  const loadUsers = React.useCallback(async () => {
    try {
      const data = await apiGet<UserOption[]>(`/api/sessions/${sessionId}/delegable-agents`);
      setUsers(data);
    } catch {
      setUsers([]);
    }
  }, [sessionId]);

  React.useEffect(() => {
    if (open) {
      loadAgents();
      loadUsers();
      setSelectedUserId('');
    }
  }, [open, loadAgents, loadUsers]);

  async function delegate() {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/agents`, { userId: selectedUserId });
      setSelectedUserId('');
      await loadAgents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('common.unexpectedError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function undelete(userId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/agents`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message ?? t('common.unexpectedError'));
      }
      await loadAgents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('common.unexpectedError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('delegation.manageTitle')}</DialogTitle>
          <DialogDescription>{t('delegation.manageDescription')}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="user-select">{t('delegation.user')}</Label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{t('delegation.user')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={delegate} disabled={submitting || !selectedUserId}>
              {t('delegation.delegateButton')}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('delegation.user')}</TableHead>
                  <TableHead>{t('delegation.email')}</TableHead>
                  <TableHead className="text-end">{t('delegation.assignedAt')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {t('common.loadingShort')}
                    </TableCell>
                  </TableRow>
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {t('delegation.noAgents')}
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.userName}</TableCell>
                      <TableCell>{agent.userEmail}</TableCell>
                      <TableCell className="text-end tabular-nums">
                         {formatDate(agent.assignedAt)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => undelete(agent.userId)}
                          disabled={submitting}
                          className="text-destructive"
                        >
                          {t('delegation.undelegateButton')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
