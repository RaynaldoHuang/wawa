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
import {
  MoreHorizontal,
  Ban,
  UserCheck,
  Shield,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  // Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
  });

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'USER' });
    setUserToEdit(null);
  };

  const handleEditClick = (user: User) => {
    setUserToEdit(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't fill password
      role: user.role,
    });
    setIsEditOpen(true);
  };

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

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const res = await fetch(`/api/admin/users/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          role: data.role,
          ...(data.password ? { password: data.password } : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed to update user');
      return res.json();
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to update user');
    },
  });

  // Delete (Ban) User Mutation - Explicit Delete Action
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      // We use the DELETE endpoint which performs soft delete (BAN)
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      toast.success('User deleted (banned) successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => {
      toast.error('Failed to delete user');
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
              <DropdownMenuItem onClick={() => handleEditClick(user)}>
                <Pencil className='mr-2 h-4 w-4' /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => banMutation.mutate(user.id)}
                className={
                  user.status === 'BANNED'
                    ? 'text-green-600'
                    : 'text-orange-600'
                }
              >
                {user.status === 'BANNED' ? (
                  <>
                    <UserCheck className='mr-2 h-4 w-4' /> Unban
                  </>
                ) : (
                  <>
                    <Ban className='mr-2 h-4 w-4' /> Ban (Suspend)
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(user.id)}
                className='text-red-600'
              >
                <Trash2 className='mr-2 h-4 w-4' /> Delete
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
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold'>Users & Staff</h1>
          <p className='text-muted-foreground'>
            Manage users and staff members
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className='mr-2 h-4 w-4' /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='name'>Name</Label>
                <Input
                  id='name'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='email'>Email</Label>
                <Input
                  id='email'
                  type='email'
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='password'>Password</Label>
                <Input
                  id='password'
                  type='password'
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='role'>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) =>
                    setFormData({ ...formData, role: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select Role' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='USER'>User</SelectItem>
                    <SelectItem value='STAFF'>Staff</SelectItem>
                    <SelectItem value='ADMIN'>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setIsAddOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='edit-name'>Name</Label>
                <Input
                  id='edit-name'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='edit-email'>Email</Label>
                <Input
                  id='edit-email'
                  type='email'
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='edit-password'>
                  Password (Leave blank to keep)
                </Label>
                <Input
                  id='edit-password'
                  type='password'
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='edit-role'>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) =>
                    setFormData({ ...formData, role: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select Role' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='USER'>User</SelectItem>
                    <SelectItem value='STAFF'>Staff</SelectItem>
                    <SelectItem value='ADMIN'>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setIsEditOpen(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  userToEdit &&
                  updateMutation.mutate({ ...formData, id: userToEdit.id })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
