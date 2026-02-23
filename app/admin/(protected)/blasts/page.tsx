'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Upload, FileText, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Device = {
  id: string;
  phoneNumber: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'BANNED';
};

type BlastJob = {
  id: string;
  message: string;
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
};

type RecipientMetaMap = Record<string, Record<string, unknown>>;

function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

function parseRecipientsInput(text: string): string[] {
  const normalized = text
    .split(/[,\n\r\t]+/)
    .map((item) => normalizePhoneNumber(item.trim()))
    .filter((item) => item.length >= 10);

  return [...new Set(normalized)];
}

function parseCsvRecipients(text: string): {
  recipients: string[];
  metaMap: RecipientMetaMap;
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { recipients: [], metaMap: {} };
  }

  const firstLine = lines[0].toLowerCase();
  const hasHeader = /phone|nomor|name|nama/.test(firstLine);
  const headers = hasHeader
    ? lines[0].split(',').map((header) => header.trim())
    : ['phone'];

  const startIndex = hasHeader ? 1 : 0;
  const recipients: string[] = [];
  const metaMap: RecipientMetaMap = {};

  for (let index = startIndex; index < lines.length; index += 1) {
    const cols = lines[index].split(',').map((col) => col.trim());

    const phoneIndex = headers.findIndex((header) => {
      const value = header.toLowerCase();
      return value === 'phone' || value === 'nomor' || value === 'msisdn';
    });

    const phoneRaw = cols[phoneIndex >= 0 ? phoneIndex : 0] || '';
    const phone = normalizePhoneNumber(phoneRaw);
    if (phone.length < 10) continue;

    recipients.push(phone);

    const meta: Record<string, unknown> = {};
    headers.forEach((header, colIndex) => {
      const key = header.trim();
      if (!key) return;
      if (['phone', 'nomor', 'msisdn'].includes(key.toLowerCase())) return;

      const value = cols[colIndex];
      if (value) {
        meta[key] = value;
      }
    });

    if (Object.keys(meta).length > 0) {
      metaMap[phone] = meta;
    }
  }

  return {
    recipients: [...new Set(recipients)],
    metaMap,
  };
}

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
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [devices, setDevices] = React.useState<Device[]>([]);
  const [jobs, setJobs] = React.useState<BlastJob[]>([]);
  const [loadingDevices, setLoadingDevices] = React.useState(true);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewResult, setPreviewResult] = React.useState<string>('');

  const [title, setTitle] = React.useState('');
  const [deviceId, setDeviceId] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [recipientInput, setRecipientInput] = React.useState('');
  const [attachmentUrl, setAttachmentUrl] = React.useState('');
  const [attachmentFileName, setAttachmentFileName] = React.useState('');
  const [attachmentType, setAttachmentType] = React.useState('image');
  const [variablesData, setVariablesData] = React.useState('{"name":"Budi"}');
  const [ctaData, setCtaData] = React.useState(
    '{"label":"Order Sekarang","url":"https://example.com"}',
  );
  const [scheduleEnabled, setScheduleEnabled] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState('');
  const [recipientMetaData, setRecipientMetaData] =
    React.useState<RecipientMetaMap>({});

  // Auth check is handled by admin layout - only ADMIN can access /admin routes

  const fetchDevices = React.useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch('/api/devices', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal memuat devices');
        return;
      }

      setDevices(data);
      const connected = data.find(
        (item: Device) => item.status === 'CONNECTED',
      );
      if (connected && !deviceId) {
        setDeviceId(connected.id);
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
      const res = await fetch('/api/blasts?page=1&limit=20', {
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
    fetchDevices();
    fetchBlasts();
  }, [fetchDevices, fetchBlasts]);

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { recipients: numbers, metaMap } = parseCsvRecipients(text);

      if (numbers.length === 0) {
        toast.error('File tidak berisi nomor valid');
        return;
      }

      setRecipientInput((prev) => {
        const current = parseRecipientsInput(prev);
        const merged = [...current, ...numbers];
        return [...new Set(merged)].join('\n');
      });

      setRecipientMetaData((prev) => ({
        ...prev,
        ...metaMap,
      }));

      toast.success(`Berhasil import ${numbers.length} nomor`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal membaca file CSV');
    } finally {
      event.target.value = '';
    }
  };

  const handleAttachmentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error('Ukuran file maksimal 2MB');
      event.target.value = '';
      return;
    }

    const guessedType = file.type.toLowerCase();
    if (guessedType.includes('video')) {
      setAttachmentType('video');
    } else if (
      guessedType.includes('pdf') ||
      guessedType.includes('document')
    ) {
      setAttachmentType('document');
    } else {
      setAttachmentType('image');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        toast.error('Gagal membaca file attachment');
        return;
      }

      setAttachmentUrl(result);
      setAttachmentFileName(file.name);
      toast.success('Attachment siap digunakan');
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file attachment');
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const handlePreview = async () => {
    if (!message.trim()) {
      toast.error('Isi pesan wajib diisi');
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch('/api/blasts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          variablesData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal preview pesan');
        return;
      }

      setPreviewResult(data.rendered || '');
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    const recipients = parseRecipientsInput(recipientInput);

    if (!deviceId) {
      toast.error('Pilih device terlebih dahulu');
      return;
    }

    if (!message.trim()) {
      toast.error('Isi pesan wajib diisi');
      return;
    }

    if (recipients.length === 0) {
      toast.error('Masukkan minimal 1 nomor penerima');
      return;
    }

    if (scheduleEnabled && !scheduleAt) {
      toast.error('Pilih jadwal kirim');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/blasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title || undefined,
          deviceId,
          message,
          recipients,
          scheduleAt: scheduleEnabled
            ? new Date(scheduleAt).toISOString()
            : undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          attachmentUrl: attachmentUrl || undefined,
          attachmentType: attachmentUrl ? attachmentType : undefined,
          variablesData: variablesData || undefined,
          recipientMetaData:
            Object.keys(recipientMetaData).length > 0
              ? JSON.stringify(recipientMetaData)
              : undefined,
          ctaData: ctaData || undefined,
          campaignType: 'MARKETING',
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
          : 'Campaign berhasil dikirim ke queue',
      );

      setTitle('');
      setMessage('');
      setRecipientInput('');
      setPreviewResult('');
      setAttachmentUrl('');
      setAttachmentFileName('');
      setScheduleEnabled(false);
      setScheduleAt('');
      setRecipientMetaData({});

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

  const connectedDevices = devices.filter(
    (item) => item.status === 'CONNECTED',
  );

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
            <CardTitle>Composer Campaign</CardTitle>
            <CardDescription>
              Tulis pesan custom, import recipient, dan atur jadwal kirim.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='campaign-title'>Judul Campaign</Label>
                <Input
                  id='campaign-title'
                  placeholder='Promo Ramadan 2026'
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='device-select'>Device</Label>
                <select
                  id='device-select'
                  className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  disabled={loadingDevices}
                >
                  <option value=''>Pilih Device</option>
                  {connectedDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.phoneNumber} (CONNECTED)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='message'>Pesan</Label>
              <Textarea
                id='message'
                rows={6}
                placeholder='Halo {{name}}, promo spesial hari ini...'
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='recipients'>Recipients (manual)</Label>
              <Textarea
                id='recipients'
                rows={5}
                placeholder={'62812xxxxxxx\n62813xxxxxxx\n0812xxxxxxx'}
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
              />
              <div className='flex flex-wrap items-center gap-3'>
                <Label htmlFor='csv-upload' className='cursor-pointer'>
                  <span className='inline-flex items-center rounded-md border px-3 py-2 text-sm'>
                    <Upload className='mr-2 h-4 w-4' />
                    Upload CSV
                  </span>
                </Label>
                <Input
                  id='csv-upload'
                  type='file'
                  accept='.csv,.txt'
                  className='hidden'
                  onChange={handleCsvUpload}
                />
                <span className='text-xs text-muted-foreground'>
                  Total input: {parseRecipientsInput(recipientInput).length}{' '}
                  nomor • Personalisasi CSV:{' '}
                  {Object.keys(recipientMetaData).length}
                </span>
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='attachment-url'>
                  Attachment URL (optional)
                </Label>
                <Input
                  id='attachment-url'
                  placeholder='https://.../brosur.jpg'
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                />
                <div className='flex flex-wrap items-center gap-3'>
                  <Label htmlFor='attachment-file' className='cursor-pointer'>
                    <span className='inline-flex items-center rounded-md border px-3 py-2 text-sm'>
                      <Upload className='mr-2 h-4 w-4' />
                      Upload File Lokal
                    </span>
                  </Label>
                  <Input
                    id='attachment-file'
                    type='file'
                    accept='image/*,video/*,.pdf,.doc,.docx,.txt'
                    className='hidden'
                    onChange={handleAttachmentUpload}
                  />
                  {attachmentFileName && (
                    <span className='text-xs text-muted-foreground'>
                      {attachmentFileName}
                    </span>
                  )}
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='attachment-type'>Attachment Type</Label>
                <select
                  id='attachment-type'
                  className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                  value={attachmentType}
                  onChange={(event) => setAttachmentType(event.target.value)}
                >
                  <option value='image'>Image</option>
                  <option value='document'>Document</option>
                  <option value='video'>Video</option>
                </select>
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='variables-data'>Variables JSON</Label>
                <Textarea
                  id='variables-data'
                  rows={4}
                  value={variablesData}
                  onChange={(event) => setVariablesData(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='cta-data'>CTA JSON</Label>
                <Textarea
                  id='cta-data'
                  rows={4}
                  value={ctaData}
                  onChange={(event) => setCtaData(event.target.value)}
                />
              </div>
            </div>

            <div className='space-y-3'>
              <label className='inline-flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={scheduleEnabled}
                  onChange={(event) => setScheduleEnabled(event.target.checked)}
                />
                Jadwalkan campaign
              </label>
              {scheduleEnabled && (
                <Input
                  type='datetime-local'
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              )}
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                onClick={handlePreview}
                disabled={previewLoading}
              >
                {previewLoading ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <FileText className='mr-2 h-4 w-4' />
                )}
                Preview Pesan
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || loadingDevices}
              >
                {submitting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Send className='mr-2 h-4 w-4' />
                )}
                {scheduleEnabled ? 'Jadwalkan Campaign' : 'Kirim Campaign'}
              </Button>
            </div>

            {previewResult && (
              <div className='rounded-md border p-3 text-sm'>
                <p className='mb-2 font-medium'>Preview Rendered Message</p>
                <p className='whitespace-pre-wrap text-muted-foreground'>
                  {previewResult}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety Notes</CardTitle>
            <CardDescription>
              Praktik aman untuk mengurangi risiko ban WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>- Gunakan recipient dengan consent.</p>
            <p>- Hindari blast massal mendadak dari device baru.</p>
            <p>- Gunakan template variatif dan placeholder personalisasi.</p>
            <p>- Hormati opt-out keyword (STOP/UNSUBSCRIBE).</p>
            <p>- Jadwalkan campaign di luar quiet hours jika diperlukan.</p>
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
                      <span className='text-xs text-muted-foreground'>
                        {job.device.phoneNumber}
                      </span>
                    </div>
                    <p className='text-sm font-medium line-clamp-1'>
                      {job.message}
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
