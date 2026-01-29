'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/admin/data-table';
import { MoreHorizontal, Wifi, WifiOff, Trash2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface Device {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'BANNED';
  totalBlast: number;
  totalSuccess: number;
  totalFailed: number;
  lastActiveAt: string | null;
  connectedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface DevicesResponse {
  data: Device[];
  totalPages: number;
  total: number;
}

const statusColors = {
  CONNECTED: 'default',
  DISCONNECTED: 'secondary',
  PAIRING: 'outline',
  BANNED: 'destructive',
} as const;

export default function AdminDevicesPage() {
  const queryClient = useQueryClient();

  // Table state
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState([{ id: 'createdAt', desc: true }]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [rowSelection, setRowSelection] = useState({});

  // Fetch devices
  const { data, isLoading } = useQuery<DevicesResponse>({
    queryKey: ['admin-devices', pagination, sorting, statusFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
        sortField: sorting[0]?.id || 'createdAt',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end }),
      });
      const res = await fetch(`/api/admin/devices?${params}`);
      if (!res.ok) throw new Error('Failed to fetch devices');
      return res.json();
    },
  });

  const handleExport = () => {
    const params = new URLSearchParams({
      sortField: sorting[0]?.id || 'createdAt',
      sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(dateRange.start && { startDate: dateRange.start }),
      ...(dateRange.end && { endDate: dateRange.end }),
    });
    window.open(`/api/admin/devices/export?${params}`, '_blank');
  };

  // Force disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await fetch(`/api/admin/devices/${deviceId}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to disconnect device');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Device disconnected successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
    },
    onError: () => {
      toast.error('Failed to disconnect device');
    },
  });

  // Clear junk sessions mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/sessions/cleanup', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to cleanup sessions');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Cleaned up ${data.cleanedCount} junk sessions`);
      queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
    },
    onError: () => {
      toast.error('Failed to cleanup sessions');
    },
  });

  const handlePaginationChange = (
    updater:
      | typeof pagination
      | ((old: typeof pagination) => typeof pagination),
  ) => {
    const newPagination =
      typeof updater === 'function' ? updater(pagination) : updater;
    if (newPagination.pageIndex !== pagination.pageIndex) {
      setRowSelection({});
    }
    setPagination(newPagination);
  };

  const columns: ColumnDef<Device>[] = [
    {
      accessorKey: 'phoneNumber',
      header: 'Phone Number',
      cell: ({ row }) => (
        <div>
          <p className='font-medium font-mono'>{row.original.phoneNumber}</p>
          {row.original.displayName && (
            <p className='text-sm text-muted-foreground'>
              {row.original.displayName}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'user.name',
      header: 'Owner',
      cell: ({ row }) => (
        <div>
          <p className='font-medium'>{row.original.user.name}</p>
          <p className='text-sm text-muted-foreground'>
            {row.original.user.email}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant={statusColors[status]}>
            {status === 'CONNECTED' && <Wifi className='mr-1 h-3 w-3' />}
            {status === 'DISCONNECTED' && <WifiOff className='mr-1 h-3 w-3' />}
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'totalSuccess',
      header: 'Messages',
      cell: ({ row }) => (
        <div className='text-sm'>
          <span className='text-green-600'>{row.original.totalSuccess}</span>
          {' / '}
          <span className='text-red-600'>{row.original.totalFailed}</span>
          {' / '}
          <span>{row.original.totalBlast}</span>
        </div>
      ),
    },
    {
      accessorKey: 'connectedAt',
      header: 'Connected',
      cell: ({ row }) => (
        <span>
          {row.original.connectedAt
            ? new Date(row.original.connectedAt).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const device = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => disconnectMutation.mutate(device.id)}
                disabled={device.status !== 'CONNECTED'}
              >
                <WifiOff className='mr-2 h-4 w-4' />
                Force Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Devices</h1>
          <p className='text-muted-foreground'>
            Manage all WhatsApp devices connected to the system
          </p>
        </div>
        <Button
          variant='outline'
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isPending}
        >
          <Trash2 className='mr-2 h-4 w-4' />
          Clear Junk Sessions
        </Button>
      </div>

      {/* Filters */}
      <div className='flex items-center gap-4 flex-wrap'>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Filter by status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Status</SelectItem>
            <SelectItem value='CONNECTED'>Connected</SelectItem>
            <SelectItem value='DISCONNECTED'>Disconnected</SelectItem>
            <SelectItem value='PAIRING'>Pairing</SelectItem>
            <SelectItem value='BANNED'>Banned</SelectItem>
          </SelectContent>
        </Select>

        <div className='flex items-center gap-2'>
          <Input
            type='date'
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, start: e.target.value }))
            }
            className='w-auto'
            placeholder='Start Date'
          />
          <span className='text-muted-foreground'>-</span>
          <Input
            type='date'
            value={dateRange.end}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, end: e.target.value }))
            }
            className='w-auto'
            placeholder='End Date'
          />
        </div>

        <Button variant='outline' onClick={handleExport} className='ml-auto'>
          <FileDown className='mr-2 h-4 w-4' />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={data?.totalPages}
        pagination={pagination}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        isLoading={isLoading}
        enableRowSelection
      />
    </div>
  );
}
