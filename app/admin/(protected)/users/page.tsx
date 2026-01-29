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
import { useDebounce } from '@/hooks/use-debounce';
import { MoreHorizontal, Ban, UserCheck, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'STAFF' | 'ADMIN';
  status: string;
  walletBalance: number;
  deviceCount: number;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  totalPages: number;
  total: number;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  // Table state
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState([{ id: 'createdAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rowSelection, setRowSelection] = useState({});

  const debouncedSearch = useDebounce(globalFilter, 300);

  // Fetch users
  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: [
      'admin-users',
      pagination,
      sorting,
      debouncedSearch,
      roleFilter,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
        sortField: sorting[0]?.id || 'createdAt',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        search: debouncedSearch,
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Ban/Unban mutation
  const banMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to update user status');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `User ${data.status === 'BANNED' ? 'banned' : 'unbanned'} successfully`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => {
      toast.error('Failed to update user status');
    },
  });

  // Bulk ban mutation
  const bulkBanMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch('/api/admin/users/bulk-ban', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) throw new Error('Failed to bulk ban users');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.count} users banned successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setRowSelection({});
    },
    onError: () => {
      toast.error('Failed to bulk ban users');
    },
  });

  // Role update mutation
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update user role');
      return res.json();
    },
    onSuccess: () => {
      toast.success('User role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => {
      toast.error('Failed to update user role');
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

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className='font-medium'>{row.original.name}</p>
          <p className='text-sm text-muted-foreground'>{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original.role;
        return (
          <Badge
            variant={
              role === 'ADMIN'
                ? 'default'
                : role === 'STAFF'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {role}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant={status === 'ACTIVE' ? 'default' : 'destructive'}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'walletBalance',
      header: 'Balance',
      cell: ({ row }) => (
        <span>Rp {row.original.walletBalance.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'deviceCount',
      header: 'Devices',
      cell: ({ row }) => <span>{row.original.deviceCount}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Joined',
      cell: ({ row }) => (
        <span>{new Date(row.original.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => banMutation.mutate(user.id)}
                className={
                  user.status === 'BANNED' ? 'text-green-600' : 'text-red-600'
                }
              >
                {user.status === 'BANNED' ? (
                  <>
                    <UserCheck className='mr-2 h-4 w-4' /> Unban User
                  </>
                ) : (
                  <>
                    <Ban className='mr-2 h-4 w-4' /> Ban User
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  roleMutation.mutate({ userId: user.id, role: 'STAFF' })
                }
                disabled={user.role === 'STAFF'}
              >
                <Shield className='mr-2 h-4 w-4' /> Make Staff
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  roleMutation.mutate({ userId: user.id, role: 'USER' })
                }
                disabled={user.role === 'USER'}
              >
                <Shield className='mr-2 h-4 w-4' /> Make User
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
    .filter(Boolean) as string[];

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Users & Staff</h1>
        <p className='text-muted-foreground'>Manage users and staff members</p>
      </div>

      {/* Filters */}
      <div className='flex items-center gap-4'>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className='w-[150px]'>
            <SelectValue placeholder='Filter by role' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Roles</SelectItem>
            <SelectItem value='USER'>User</SelectItem>
            <SelectItem value='STAFF'>Staff</SelectItem>
            <SelectItem value='ADMIN'>Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-[150px]'>
            <SelectValue placeholder='Filter by status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Status</SelectItem>
            <SelectItem value='ACTIVE'>Active</SelectItem>
            <SelectItem value='BANNED'>Banned</SelectItem>
          </SelectContent>
        </Select>
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
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        isLoading={isLoading}
        enableRowSelection
        searchPlaceholder='Search users...'
        bulkActions={
          <Button
            variant='destructive'
            size='sm'
            onClick={() => bulkBanMutation.mutate(selectedIds)}
            disabled={bulkBanMutation.isPending}
          >
            <Ban className='mr-2 h-4 w-4' />
            Ban Selected
          </Button>
        }
      />
    </div>
  );
}
