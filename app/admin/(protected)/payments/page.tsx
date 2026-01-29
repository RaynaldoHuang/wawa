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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/admin/data-table';
import { MoreHorizontal, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankName: string;
  accountNum: string;
  accountName: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'REJECTED';
  note: string | null;
  processedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface WithdrawalsResponse {
  data: Withdrawal[];
  totalPages: number;
  total: number;
}

const statusColors = {
  PENDING: 'outline',
  PROCESSING: 'secondary',
  SUCCESS: 'default',
  REJECTED: 'destructive',
} as const;

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();

  // Table state
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState([{ id: 'createdAt', desc: true }]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pendingOver24h, setPendingOver24h] = useState(false);
  const [rowSelection, setRowSelection] = useState({});

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch withdrawals
  const { data, isLoading } = useQuery<WithdrawalsResponse>({
    queryKey: [
      'admin-withdrawals',
      pagination,
      sorting,
      statusFilter,
      pendingOver24h,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
        sortField: sorting[0]?.id || 'createdAt',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(pendingOver24h && { pendingOver24h: 'true' }),
      });
      const res = await fetch(`/api/admin/withdrawals?${params}`);
      if (!res.ok) throw new Error('Failed to fetch withdrawals');
      return res.json();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const res = await fetch(
        `/api/admin/withdrawals/${withdrawalId}/approve`,
        {
          method: 'PATCH',
        },
      );
      if (!res.ok) throw new Error('Failed to approve withdrawal');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Withdrawal approved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    },
    onError: () => {
      toast.error('Failed to approve withdrawal');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      withdrawalId,
      reason,
    }: {
      withdrawalId: string;
      reason: string;
    }) => {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to reject withdrawal');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Withdrawal rejected successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectReason('');
    },
    onError: () => {
      toast.error('Failed to reject withdrawal');
    },
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (withdrawalIds: string[]) => {
      const res = await fetch('/api/admin/withdrawals/bulk-approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalIds }),
      });
      if (!res.ok) throw new Error('Failed to bulk approve');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.count} withdrawals approved successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setRowSelection({});
    },
    onError: () => {
      toast.error('Failed to bulk approve');
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

  const columns: ColumnDef<Withdrawal>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.id.slice(0, 8)}...
        </span>
      ),
    },
    {
      accessorKey: 'user.name',
      header: 'User',
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
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <div>
          <p className='font-medium'>
            Rp {row.original.amount.toLocaleString()}
          </p>
          <p className='text-xs text-muted-foreground'>
            Fee: Rp {row.original.fee.toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'bankName',
      header: 'Bank Details',
      cell: ({ row }) => (
        <div className='text-sm'>
          <p className='font-medium'>{row.original.bankName}</p>
          <p className='font-mono'>{row.original.accountNum}</p>
          <p className='text-muted-foreground'>{row.original.accountName}</p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return <Badge variant={statusColors[status]}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Requested',
      cell: ({ row }) => (
        <span className='text-sm'>
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const withdrawal = row.original;
        if (withdrawal.status !== 'PENDING') return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => approveMutation.mutate(withdrawal.id)}
                className='text-green-600'
              >
                <Check className='mr-2 h-4 w-4' />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setRejectingId(withdrawal.id);
                  setRejectDialogOpen(true);
                }}
                className='text-red-600'
              >
                <X className='mr-2 h-4 w-4' />
                Reject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key as keyof typeof rowSelection])
    .map((key) => data?.data[Number(key)]?.id)
    .filter((id): id is string => {
      const withdrawal = data?.data.find((w) => w.id === id);
      return !!id && withdrawal?.status === 'PENDING';
    });

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Payments</h1>
        <p className='text-muted-foreground'>
          Manage withdrawal requests and commissions
        </p>
      </div>

      {/* Filters */}
      <div className='flex items-center gap-4'>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-[150px]'>
            <SelectValue placeholder='Filter by status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Status</SelectItem>
            <SelectItem value='PENDING'>Pending</SelectItem>
            <SelectItem value='PROCESSING'>Processing</SelectItem>
            <SelectItem value='SUCCESS'>Success</SelectItem>
            <SelectItem value='REJECTED'>Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={pendingOver24h ? 'default' : 'outline'}
          size='sm'
          onClick={() => setPendingOver24h(!pendingOver24h)}
        >
          Pending &gt; 24h
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
        bulkActions={
          selectedIds.length > 0 && (
            <Button
              size='sm'
              onClick={() => bulkApproveMutation.mutate(selectedIds)}
              disabled={bulkApproveMutation.isPending}
            >
              <Check className='mr-2 h-4 w-4' />
              Approve Selected ({selectedIds.length})
            </Button>
          )
        }
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this withdrawal. The amount
              will be refunded to the user&apos;s wallet.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder='Reason for rejection...'
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (rejectingId && rejectReason) {
                  rejectMutation.mutate({
                    withdrawalId: rejectingId,
                    reason: rejectReason,
                  });
                }
              }}
              disabled={!rejectReason || rejectMutation.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
