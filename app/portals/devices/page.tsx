'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  MoreVertical,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Device {
  id: string;
  phoneNumber: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'BANNED';
  totalBlast: number;
  totalSuccess: number;
  totalFailed: number;
  createdAt: string;
  lastActiveAt?: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deviceToDelete, setDeviceToDelete] = React.useState<Device | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devices', { credentials: 'include' });
      const data = await res.json();
      setDevices(data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDevices();
  }, []);

  const handleDelete = async () => {
    if (!deviceToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/devices/${deviceToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Device berhasil dihapus');
        setDevices((prev) => prev.filter((d) => d.id !== deviceToDelete.id));
      } else {
        const error = await res.json();
        toast.error(error.error || 'Gagal menghapus device');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeviceToDelete(null);
    }
  };

  const getStatusBadge = (status: Device['status']) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <Badge className='bg-green-500/10 text-green-500 border-green-500/20'>
            <Wifi className='mr-1 h-3 w-3' />
            Connected
          </Badge>
        );
      case 'PAIRING':
        return (
          <Badge variant='secondary' className='animate-pulse'>
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            Pairing
          </Badge>
        );
      case 'BANNED':
        return <Badge variant='destructive'>Banned</Badge>;
      default:
        return (
          <Badge variant='outline' className='text-muted-foreground'>
            <WifiOff className='mr-1 h-3 w-3' />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Devices</h1>
          <p className='text-muted-foreground'>
            Kelola device WhatsApp yang terhubung
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={fetchDevices}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href='/portals/devices/connect'>
              <Plus className='mr-2 h-4 w-4' />
              Tambah Device
            </Link>
          </Button>
        </div>
      </div>

      {/* Devices Grid */}
      {loading ? (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className='p-6'>
                <Skeleton className='h-12 w-12 rounded-full mb-4' />
                <Skeleton className='h-6 w-32 mb-2' />
                <Skeleton className='h-4 w-24' />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16'>
            <div className='h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4'>
              <Smartphone className='h-10 w-10 text-muted-foreground' />
            </div>
            <h3 className='text-lg font-semibold mb-1'>Belum Ada Device</h3>
            <p className='text-muted-foreground text-center mb-4'>
              Hubungkan nomor WhatsApp untuk mulai blast pesan
            </p>
            <Button asChild>
              <Link href='/portals/devices/connect'>
                <Plus className='mr-2 h-4 w-4' />
                Hubungkan Device
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {devices.map((device) => (
            <Card
              key={device.id}
              className='group relative overflow-hidden transition-all hover:shadow-lg'
            >
              <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
              <CardHeader className='pb-2'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='flex size-12 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 text-blue-500'>
                      <Smartphone className='size-6' />
                    </div>
                    <div>
                      <CardTitle className='text-lg'>
                        {device.phoneNumber}
                      </CardTitle>
                      {getStatusBadge(device.status)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' size='icon' className='h-8 w-8'>
                        <MoreVertical className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem
                        className='text-destructive focus:text-destructive'
                        onClick={() => {
                          setDeviceToDelete(device);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className='mr-2 h-4 w-4' />
                        Hapus Device
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-3 gap-4 mt-4 text-center'>
                  <div className='p-2 rounded-lg bg-muted/50'>
                    <p className='text-2xl font-bold'>{device.totalBlast}</p>
                    <p className='text-xs text-muted-foreground'>Total</p>
                  </div>
                  <div className='p-2 rounded-lg bg-green-500/10'>
                    <p className='text-2xl font-bold text-green-600'>
                      {device.totalSuccess}
                    </p>
                    <p className='text-xs text-muted-foreground'>Sukses</p>
                  </div>
                  <div className='p-2 rounded-lg bg-red-500/10'>
                    <p className='text-2xl font-bold text-red-600'>
                      {device.totalFailed}
                    </p>
                    <p className='text-xs text-muted-foreground'>Gagal</p>
                  </div>
                </div>
                {device.lastActiveAt && (
                  <p className='text-xs text-muted-foreground mt-4 text-center'>
                    Terakhir aktif:{' '}
                    {new Date(device.lastActiveAt).toLocaleString('id-ID')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Device</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus device{' '}
              <strong>{deviceToDelete?.phoneNumber}</strong>? Tindakan ini tidak
              dapat dibatalkan dan akan menghapus semua data session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
