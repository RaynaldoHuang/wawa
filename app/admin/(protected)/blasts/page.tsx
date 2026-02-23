'use client';

import * as React from 'react';
import { Loader2, Send, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Device = {
  id: string;
  phoneNumber: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'BANNED';
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type CampaignOption = {
  id: string;
  name: string;
  campaignType: string;
  recipientCount: number;
  blastCount: number;
  lastBlastedAt: string | null;
};

type BlastJob = {
  id: string;
  title?: string | null;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalMessages: number;
  sentCount: number;
  failedCount: number;
  scheduleAt?: string | null;
  createdAt: string;
  device: {
    id: string;
    phoneNumber: string;
    status: Device['status'];
  };
  campaign?: {
    id: string;
    name: string;
  } | null;
};

function statusBadgeVariant(status: BlastJob['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'PROCESSING':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    case 'CANCELLED':
      return 'outline';
    default:
      return 'outline';
  }
}

export default function BlastPage() {
  const [campaigns, setCampaigns] = React.useState<CampaignOption[]>([]);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [jobs, setJobs] = React.useState<BlastJob[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = React.useState(true);
  const [loadingDevices, setLoadingDevices] = React.useState(true);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [campaignId, setCampaignId] = React.useState('');
  const [deviceId, setDeviceId] = React.useState('');
  const [deviceSearch, setDeviceSearch] = React.useState('');

  const busyDeviceIds = React.useMemo(
    () =>
      new Set(
        jobs
          .filter(
            (job) => job.status === 'QUEUED' || job.status === 'PROCESSING',
          )
          .map((job) => job.device.id),
      ),
    [jobs],
  );

  const fetchCampaigns = React.useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/admin/campaigns/options', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal memuat campaign');
        return;
      }

      const list = Array.isArray(data) ? data : [];
      setCampaigns(list);

      if (!campaignId && list.length > 0) {
        setCampaignId(list[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat memuat campaign');
    } finally {
      setLoadingCampaigns(false);
    }
  }, [campaignId]);

  const fetchDevices = React.useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch(
        '/api/admin/devices?page=1&limit=200&sortField=createdAt&sortOrder=desc',
        {
          credentials: 'include',
          cache: 'no-store',
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal memuat devices');
        return;
      }

      const list = data.data || [];
      setDevices(list);

      if (!deviceId) {
        const connected = list.find(
          (item: Device) => item.status === 'CONNECTED',
        );
        if (connected) {
          setDeviceId(connected.id);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat memuat devices');
    } finally {
      setLoadingDevices(false);
    }
  }, [deviceId]);

  const fetchBlasts = React.useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch('/api/blasts?page=1&limit=30', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal memuat blast jobs');
        return;
      }
      setJobs(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat memuat blast jobs');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCampaigns();
    fetchDevices();
    fetchBlasts();
  }, [fetchCampaigns, fetchDevices, fetchBlasts]);

  const handleSubmit = async () => {
    if (!campaignId) {
      toast.error('Pilih campaign terlebih dahulu');
      return;
    }

    if (!deviceId) {
      toast.error('Pilih device terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/blasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignId,
          deviceId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal membuat blast');
        return;
      }

      toast.success(
        data.scheduled
          ? 'Campaign berhasil dijadwalkan'
          : 'Blast berhasil dikirim ke queue',
      );

      await fetchBlasts();
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat membuat blast');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      const res = await fetch(`/api/blasts/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal membatalkan blast');
        return;
      }

      toast.success('Blast dibatalkan');
      await fetchBlasts();
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat membatalkan blast');
    }
  };

  const filteredDevices = React.useMemo(() => {
    const keyword = deviceSearch.trim().toLowerCase();

    return devices.filter((device) => {
      if (!keyword) return true;

      return [
        device.phoneNumber,
        device.user?.name || '',
        device.user?.email || '',
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [devices, deviceSearch]);

  const selectedCampaign = campaigns.find((item) => item.id === campaignId);

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Blast Marketing</h1>
          <p className='text-muted-foreground'>
            Kirim campaign WhatsApp yang aman, terjadwal, dan mudah dikelola.
          </p>
        </div>
        <Button variant='outline' onClick={fetchBlasts} disabled={loadingJobs}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle>Blast Campaign</CardTitle>
            <CardDescription>
              1) Pilih campaign, 2) pilih device, 3) tekan Blast Sekarang.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-1'>
              <div className='space-y-2'>
                <Label htmlFor='campaign-select'>Campaign</Label>
                <select
                  id='campaign-select'
                  className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  disabled={loadingCampaigns}
                >
                  <option value=''>Pilih Campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.recipientCount} recipients)
                    </option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='device-search'>Cari Device</Label>
                <Input
                  id='device-search'
                  placeholder='Cari nomor, nama user, atau email...'
                  value={deviceSearch}
                  onChange={(event) => setDeviceSearch(event.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='device-select'>Device Blast</Label>
                <select
                  id='device-select'
                  className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  disabled={loadingDevices}
                >
                  <option value=''>Pilih Device</option>
                  {filteredDevices.map((device) => (
                    <option
                      key={device.id}
                      value={device.id}
                      disabled={device.status !== 'CONNECTED'}
                    >
                      {device.phoneNumber} • {device.status} •{' '}
                      {busyDeviceIds.has(device.id) ? 'USED' : 'IDLE'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  loadingDevices ||
                  loadingCampaigns ||
                  !campaignId ||
                  !deviceId
                }
              >
                {submitting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Send className='mr-2 h-4 w-4' />
                )}
                Blast Sekarang
              </Button>
            </div>

            {selectedCampaign && (
              <div className='rounded-md border p-3 text-sm text-muted-foreground'>
                Campaign dipilih:{' '}
                <span className='font-medium text-foreground'>
                  {selectedCampaign.name}
                </span>
                {' • '}
                {selectedCampaign.recipientCount} recipients
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device Status</CardTitle>
            <CardDescription>
              Keterangan status device pada menu pemilihan blast.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>- CONNECTED: device dapat dipilih untuk blast.</p>
            <p>- DISCONNECTED / PAIRING / BANNED: tidak dapat dipilih.</p>
            <p>- USED: sedang dipakai job QUEUED/PROCESSING.</p>
            <p>- IDLE: belum dipakai job aktif.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign History</CardTitle>
          <CardDescription>Status dan performa blast terbaru.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (
            <div className='py-8 text-center text-muted-foreground'>
              <Loader2 className='mx-auto h-5 w-5 animate-spin' />
            </div>
          ) : jobs.length === 0 ? (
            <div className='py-8 text-center text-muted-foreground'>
              Belum ada campaign.
            </div>
          ) : (
            <div className='space-y-3'>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className='rounded-lg border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'
                >
                  <div className='space-y-1'>
                    <div className='flex items-center gap-2'>
                      <Badge variant={statusBadgeVariant(job.status)}>
                        {job.status}
                      </Badge>
                      {job.campaign?.name && (
                        <span className='text-xs text-muted-foreground'>
                          {job.campaign.name}
                        </span>
                      )}
                      <span className='text-xs text-muted-foreground'>
                        {job.device.phoneNumber}
                      </span>
                    </div>
                    <p className='text-sm font-medium line-clamp-1'>
                      {job.title || 'Campaign Blast'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Total: {job.totalMessages} • Sent: {job.sentCount} •
                      Failed: {job.failedCount}
                    </p>
                    {job.scheduleAt && (
                      <p className='text-xs text-muted-foreground'>
                        Schedule:{' '}
                        {new Date(job.scheduleAt).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  <div className='flex gap-2'>
                    {(job.status === 'QUEUED' ||
                      job.status === 'PROCESSING') && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleCancel(job.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
