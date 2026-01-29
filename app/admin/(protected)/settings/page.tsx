'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, History } from 'lucide-react';
import { toast } from 'sonner';

interface GlobalSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  target: string;
  details: string | null;
  createdAt: string;
  admin: {
    name: string;
    email: string;
  };
}

const SETTING_LABELS: Record<
  string,
  { label: string; description: string; inputType: string }
> = {
  COMMISSION_PER_MSG: {
    label: 'Commission per Message',
    description: 'Amount earned per successful message (in Rupiah)',
    inputType: 'number',
  },
  MIN_WITHDRAWAL: {
    label: 'Minimum Withdrawal',
    description: 'Minimum amount for withdrawal requests (in Rupiah)',
    inputType: 'number',
  },
  WITHDRAWAL_FEE: {
    label: 'Withdrawal Fee',
    description: 'Fee deducted from each withdrawal (in Rupiah)',
    inputType: 'number',
  },
};

const DEFAULT_SETTINGS = [
  { key: 'COMMISSION_PER_MSG', value: '500' },
  { key: 'MIN_WITHDRAWAL', value: '50000' },
  { key: 'WITHDRAWAL_FEE', value: '2500' },
];

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>(
    {},
  );

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery<
    GlobalSetting[]
  >({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Fetch recent audit logs
  const { data: auditLogs } = useQuery<{ data: AuditLog[] }>({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/audit-logs?limit=5');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
  });

  // Update setting mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      key,
      value,
      description,
    }: {
      key: string;
      value: string;
      description?: string;
    }) => {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, description }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Setting updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
    onError: () => {
      toast.error('Failed to update setting');
    },
  });

  // Merge default settings with fetched settings
  const allSettings = DEFAULT_SETTINGS.map((defaultSetting) => {
    const existing = settings?.find((s) => s.key === defaultSetting.key);
    return (
      existing || {
        ...defaultSetting,
        id: '',
        description: null,
        updatedAt: '',
      }
    );
  });

  const handleSave = (key: string) => {
    const value = editedSettings[key];
    if (value !== undefined) {
      updateMutation.mutate({
        key,
        value,
        description: SETTING_LABELS[key]?.description,
      });
      // Clear edited state after save
      setEditedSettings((prev) => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  const getSettingValue = (key: string) => {
    if (editedSettings[key] !== undefined) return editedSettings[key];
    return (
      settings?.find((s) => s.key === key)?.value ||
      DEFAULT_SETTINGS.find((s) => s.key === key)?.value ||
      ''
    );
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Settings</h1>
        <p className='text-muted-foreground'>
          Configure global system settings
        </p>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Settings Form */}
        <Card className='p-6'>
          <h2 className='text-lg font-semibold mb-4'>Global Configuration</h2>
          {settingsLoading ? (
            <div className='space-y-4'>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className='h-20 w-full' />
              ))}
            </div>
          ) : (
            <div className='space-y-6'>
              {allSettings.map((setting) => {
                const config = SETTING_LABELS[setting.key] || {
                  label: setting.key,
                  description: setting.description || '',
                  inputType: 'text',
                };
                const hasChanges = editedSettings[setting.key] !== undefined;

                return (
                  <div key={setting.key} className='space-y-2'>
                    <Label htmlFor={setting.key}>{config.label}</Label>
                    <div className='flex gap-2'>
                      <div className='relative flex-1'>
                        {config.inputType === 'number' && (
                          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'>
                            Rp
                          </span>
                        )}
                        <Input
                          id={setting.key}
                          type={config.inputType}
                          value={getSettingValue(setting.key)}
                          onChange={(e) =>
                            setEditedSettings((prev) => ({
                              ...prev,
                              [setting.key]: e.target.value,
                            }))
                          }
                          className={
                            config.inputType === 'number' ? 'pl-10' : ''
                          }
                        />
                      </div>
                      <Button
                        size='icon'
                        onClick={() => handleSave(setting.key)}
                        disabled={!hasChanges || updateMutation.isPending}
                        variant={hasChanges ? 'default' : 'outline'}
                      >
                        <Save className='h-4 w-4' />
                      </Button>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {config.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent Audit Logs */}
        <Card className='p-6'>
          <div className='flex items-center gap-2 mb-4'>
            <History className='h-5 w-5' />
            <h2 className='text-lg font-semibold'>Recent Activity</h2>
          </div>
          <div className='space-y-4'>
            {auditLogs?.data.map((log) => (
              <div key={log.id} className='border-b pb-3 last:border-0'>
                <div className='flex items-start justify-between'>
                  <div>
                    <p className='font-medium text-sm'>{log.action}</p>
                    <p className='text-xs text-muted-foreground'>
                      by {log.admin.name}
                    </p>
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                {log.details && (
                  <p className='text-xs text-muted-foreground mt-1 font-mono'>
                    {log.details}
                  </p>
                )}
              </div>
            ))}
            {(!auditLogs?.data || auditLogs.data.length === 0) && (
              <p className='text-sm text-muted-foreground'>
                No recent activity
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Formula Explanation */}
      <Card className='p-6'>
        <h2 className='text-lg font-semibold mb-4'>Commission Formula</h2>
        <div className='bg-muted p-4 rounded-lg font-mono text-sm'>
          <p>
            User Earnings = Total Successful Messages × Commission per Message
          </p>
          <p className='mt-2 text-muted-foreground'>
            Example: 1000 messages × Rp {getSettingValue('COMMISSION_PER_MSG')}{' '}
            = Rp{' '}
            {(
              1000 * Number(getSettingValue('COMMISSION_PER_MSG'))
            ).toLocaleString()}
          </p>
        </div>
      </Card>
    </div>
  );
}
