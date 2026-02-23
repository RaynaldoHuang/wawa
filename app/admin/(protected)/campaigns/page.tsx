'use client';

import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  message: string;
  recipients: unknown;
  variablesData: unknown;
  ctaData: unknown;
  attachmentUrl: string | null;
  attachmentType: string | null;
  campaignType: string;
  isActive: boolean;
  blastCount: number;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
};

type CampaignResponse = {
  data: Campaign[];
  totalPages: number;
  total: number;
};

type CampaignForm = {
  name: string;
  description: string;
  message: string;
  recipientsText: string;
  variablesData: string;
  ctaData: string;
  attachmentUrl: string;
  attachmentType: string;
  campaignType: string;
  isActive: boolean;
};

const initialForm: CampaignForm = {
  name: '',
  description: '',
  message: '',
  recipientsText: '',
  variablesData: '{"name":"Budi"}',
  ctaData: '{"label":"Order Sekarang","url":"https://example.com"}',
  attachmentUrl: '',
  attachmentType: 'image',
  campaignType: 'MARKETING',
  isActive: true,
};

function parseCsvRecipients(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const firstLine = lines[0].toLowerCase();
  const hasHeader = /phone|nomor|name|nama/.test(firstLine);
  const headers = hasHeader
    ? lines[0].split(',').map((header) => header.trim())
    : ['phone'];

  const startIndex = hasHeader ? 1 : 0;
  const recipients: string[] = [];

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
  }

  return [...new Set(recipients)];
}

function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

function parseRecipientsInput(text: string): string[] {
  const normalized = text
    .split(/[,\n\r\t]+/)
    .map((item) => normalizePhoneNumber(item.trim()))
    .filter((item) => item.length >= 10);

  return [...new Set(normalized)];
}

function recipientsToText(recipients: unknown): string {
  if (!Array.isArray(recipients)) return '';
  return recipients.filter((item) => typeof item === 'string').join('\n');
}

function jsonToText(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

export default function AdminCampaignsPage() {
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(initialForm);
  const [attachmentFileName, setAttachmentFileName] = useState('');

  const { data, isLoading } = useQuery<CampaignResponse>({
    queryKey: [
      'admin-campaigns',
      pagination,
      sorting,
      globalFilter,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
        sortField: sorting[0]?.id || 'createdAt',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        search: globalFilter,
        status: statusFilter,
      });

      const res = await fetch(`/api/admin/campaigns?${params}`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const recipients = parseRecipientsInput(form.recipientsText);
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          message: form.message,
          recipients,
          variablesData: form.variablesData || undefined,
          ctaData: form.ctaData || undefined,
          attachmentUrl: form.attachmentUrl || undefined,
          attachmentType: form.attachmentUrl ? form.attachmentType : undefined,
          campaignType: form.campaignType,
          isActive: form.isActive,
        }),
      });

      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || 'Failed to create campaign');
      return payload;
    },
    onSuccess: () => {
      toast.success('Campaign berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      setIsCreateOpen(false);
      setForm(initialForm);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCampaign) return;
      const recipients = parseRecipientsInput(form.recipientsText);
      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description || null,
        isActive: form.isActive,
      };

      if (editingCampaign.blastCount === 0) {
        payload.message = form.message;
        payload.recipients = recipients;
        payload.variablesData = form.variablesData || undefined;
        payload.ctaData = form.ctaData || undefined;
        payload.attachmentUrl = form.attachmentUrl || undefined;
        payload.attachmentType = form.attachmentUrl
          ? form.attachmentType
          : undefined;
        payload.campaignType = form.campaignType;
      }

      const res = await fetch(`/api/admin/campaigns/${editingCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responsePayload = await res.json();
      if (!res.ok) {
        throw new Error(responsePayload.error || 'Failed to update campaign');
      }

      return responsePayload;
    },
    onSuccess: () => {
      toast.success('Campaign berhasil diupdate');
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      setIsEditOpen(false);
      setEditingCampaign(null);
      setForm(initialForm);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || 'Failed to delete campaign');
      return payload;
    },
    onSuccess: () => {
      toast.success('Campaign berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openEditDialog = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description || '',
      message: campaign.message,
      recipientsText: recipientsToText(campaign.recipients),
      variablesData: jsonToText(
        campaign.variablesData,
        initialForm.variablesData,
      ),
      ctaData: jsonToText(campaign.ctaData, initialForm.ctaData),
      attachmentUrl: campaign.attachmentUrl || '',
      attachmentType: campaign.attachmentType || 'image',
      campaignType: campaign.campaignType,
      isActive: campaign.isActive,
    });
    setAttachmentFileName('');
    setIsEditOpen(true);
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const numbers = parseCsvRecipients(text);

      if (numbers.length === 0) {
        toast.error('File tidak berisi nomor valid');
        return;
      }

      setForm((prev) => {
        const current = parseRecipientsInput(prev.recipientsText);
        const merged = [...current, ...numbers];
        return {
          ...prev,
          recipientsText: [...new Set(merged)].join('\n'),
        };
      });

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
    let nextAttachmentType = 'image';

    if (guessedType.includes('video')) {
      nextAttachmentType = 'video';
    } else if (
      guessedType.includes('pdf') ||
      guessedType.includes('document')
    ) {
      nextAttachmentType = 'document';
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        toast.error('Gagal membaca file attachment');
        return;
      }

      setForm((prev) => ({
        ...prev,
        attachmentUrl: result,
        attachmentType: nextAttachmentType,
      }));
      setAttachmentFileName(file.name);
      toast.success('Attachment siap digunakan');
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file attachment');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const columns = useMemo<ColumnDef<Campaign>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Campaign',
        cell: ({ row }) => (
          <div>
            <p className='font-medium'>{row.original.name}</p>
            <p className='text-sm text-muted-foreground line-clamp-1'>
              {row.original.description || '—'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'campaignType',
        header: 'Type',
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        ),
      },
      {
        id: 'recipients',
        header: 'Recipients',
        cell: ({ row }) => {
          const recipients = Array.isArray(row.original.recipients)
            ? row.original.recipients
            : [];
          return <span>{recipients.length}</span>;
        },
      },
      {
        accessorKey: 'blastCount',
        header: 'Used',
        cell: ({ row }) => (
          <span>
            {row.original.blastCount > 0
              ? `${row.original.blastCount} blast`
              : 'Idle'}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span>
            {new Date(row.original.createdAt).toLocaleDateString('id-ID')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const campaign = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon'>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => openEditDialog(campaign)}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate(campaign.id)}
                  className='text-red-600'
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [deleteMutation],
  );

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Kelola Campaign</h1>
          <p className='text-muted-foreground'>
            Buat, ubah, dan hapus campaign yang akan dipakai pada Blast.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(initialForm);
            setAttachmentFileName('');
            setIsCreateOpen(true);
          }}
        >
          <Plus className='mr-2 h-4 w-4' />
          Buat Campaign
        </Button>
      </div>

      <div className='flex items-center gap-4'>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-45'>
            <SelectValue placeholder='Filter status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Semua</SelectItem>
            <SelectItem value='active'>Active</SelectItem>
            <SelectItem value='inactive'>Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        pageCount={data?.totalPages || 1}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        isLoading={isLoading}
        searchPlaceholder='Cari campaign...'
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Campaign</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Nama Campaign</Label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Deskripsi</Label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Pesan</Label>
              <Textarea
                rows={5}
                value={form.message}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, message: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Recipients (satu nomor per baris)</Label>
              <Textarea
                rows={5}
                value={form.recipientsText}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    recipientsText: event.target.value,
                  }))
                }
              />
              <div className='flex flex-wrap items-center gap-3'>
                <Label htmlFor='create-csv-upload' className='cursor-pointer'>
                  <span className='inline-flex items-center rounded-md border px-3 py-2 text-sm'>
                    <Upload className='mr-2 h-4 w-4' />
                    Upload CSV
                  </span>
                </Label>
                <Input
                  id='create-csv-upload'
                  type='file'
                  accept='.csv,.txt'
                  className='hidden'
                  onChange={handleCsvUpload}
                />
                <span className='text-xs text-muted-foreground'>
                  Total input:{' '}
                  {parseRecipientsInput(form.recipientsText).length} nomor
                </span>
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Attachment URL (optional)</Label>
                <Input
                  value={form.attachmentUrl}
                  placeholder='https://.../brosur.jpg'
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      attachmentUrl: event.target.value,
                    }))
                  }
                />
                <div className='flex flex-wrap items-center gap-3'>
                  <Label
                    htmlFor='create-attachment-file'
                    className='cursor-pointer'
                  >
                    <span className='inline-flex items-center rounded-md border px-3 py-2 text-sm'>
                      <Upload className='mr-2 h-4 w-4' />
                      Upload File Lokal
                    </span>
                  </Label>
                  <Input
                    id='create-attachment-file'
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
                <Label>Attachment Type</Label>
                <select
                  className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                  value={form.attachmentType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      attachmentType: event.target.value,
                    }))
                  }
                >
                  <option value='image'>Image</option>
                  <option value='document'>Document</option>
                  <option value='video'>Video</option>
                </select>
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Variables JSON</Label>
                <Textarea
                  rows={4}
                  value={form.variablesData}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      variablesData: event.target.value,
                    }))
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>CTA JSON</Label>
                <Textarea
                  rows={4}
                  value={form.ctaData}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      ctaData: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label>Tipe Campaign</Label>
              <Input
                value={form.campaignType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    campaignType: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsCreateOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Nama Campaign</Label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Deskripsi</Label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Pesan</Label>
              <Textarea
                rows={5}
                value={form.message}
                disabled={(editingCampaign?.blastCount || 0) > 0}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, message: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Recipients (satu nomor per baris)</Label>
              <Textarea
                rows={5}
                value={form.recipientsText}
                disabled={(editingCampaign?.blastCount || 0) > 0}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    recipientsText: event.target.value,
                  }))
                }
              />
              <div className='flex flex-wrap items-center gap-3'>
                <Label htmlFor='edit-csv-upload' className='cursor-pointer'>
                  <span className='inline-flex items-center rounded-md border px-3 py-2 text-sm'>
                    <Upload className='mr-2 h-4 w-4' />
                    Upload CSV
                  </span>
                </Label>
                <Input
                  id='edit-csv-upload'
                  type='file'
                  accept='.csv,.txt'
                  className='hidden'
                  disabled={(editingCampaign?.blastCount || 0) > 0}
                  onChange={handleCsvUpload}
                />
                <span className='text-xs text-muted-foreground'>
                  Total input:{' '}
                  {parseRecipientsInput(form.recipientsText).length} nomor
                </span>
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Attachment URL (optional)</Label>
                <Input
                  value={form.attachmentUrl}
                  disabled={(editingCampaign?.blastCount || 0) > 0}
                  placeholder='https://.../brosur.jpg'
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      attachmentUrl: event.target.value,
                    }))
                  }
                />
                <div className='flex flex-wrap items-center gap-3'>
                  <Label
                    htmlFor='edit-attachment-file'
                    className='cursor-pointer'
                  >
                    <span className='inline-flex items-center rounded-md border px-3 py-2 text-sm'>
                      <Upload className='mr-2 h-4 w-4' />
                      Upload File Lokal
                    </span>
                  </Label>
                  <Input
                    id='edit-attachment-file'
                    type='file'
                    accept='image/*,video/*,.pdf,.doc,.docx,.txt'
                    className='hidden'
                    disabled={(editingCampaign?.blastCount || 0) > 0}
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
                <Label>Attachment Type</Label>
                <select
                  className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                  value={form.attachmentType}
                  disabled={(editingCampaign?.blastCount || 0) > 0}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      attachmentType: event.target.value,
                    }))
                  }
                >
                  <option value='image'>Image</option>
                  <option value='document'>Document</option>
                  <option value='video'>Video</option>
                </select>
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Variables JSON</Label>
                <Textarea
                  rows={4}
                  value={form.variablesData}
                  disabled={(editingCampaign?.blastCount || 0) > 0}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      variablesData: event.target.value,
                    }))
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>CTA JSON</Label>
                <Textarea
                  rows={4}
                  value={form.ctaData}
                  disabled={(editingCampaign?.blastCount || 0) > 0}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      ctaData: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {(editingCampaign?.blastCount || 0) > 0 && (
              <p className='text-xs text-muted-foreground'>
                Campaign sudah pernah dipakai blast. Field message, recipients,
                attachment, variables, CTA, dan type dikunci.
              </p>
            )}
            <div className='space-y-2'>
              <Label>Tipe Campaign</Label>
              <Input
                value={form.campaignType}
                disabled={(editingCampaign?.blastCount || 0) > 0}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    campaignType: event.target.value,
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Status</Label>
              <Select
                value={form.isActive ? 'active' : 'inactive'}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, isActive: value === 'active' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='active'>ACTIVE</SelectItem>
                  <SelectItem value='inactive'>INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsEditOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
