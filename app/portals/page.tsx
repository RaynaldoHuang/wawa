'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Wallet,
  TrendingUp,
  Plus,
  ArrowUpRight,
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

// Fetch hook (simplified for now - will use React Query in production)
function useDevices() {
  const [devices, setDevices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/devices', { credentials: 'include' })
      .then((res) => res.json())
      .then(setDevices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { devices, loading };
}

function useWallet() {
  const [wallet, setWallet] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/wallet', { credentials: 'include' })
      .then((res) => res.json())
      .then(setWallet)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { wallet, loading };
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  href,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  href?: string;
}) {
  const content = (
    <Card className='relative overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer group'>
      <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className='h-8 w-24' />
        ) : (
          <>
            <div className='text-2xl font-bold'>{value}</div>
            {description && (
              <p className='text-xs text-muted-foreground mt-1'>
                {description}
              </p>
            )}
          </>
        )}
        {href && (
          <ArrowUpRight className='absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function DashboardPage() {
  const { devices, loading: devicesLoading } = useDevices();
  const { wallet, loading: walletLoading } = useWallet();

  const connectedDevices = devices.filter(
    (d) => d.status === 'CONNECTED',
  ).length;
  const totalBlast = devices.reduce((sum, d) => sum + (d.totalBlast || 0), 0);

  return (
    <div className='space-y-8'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Dashboard</h1>
          <p className='text-muted-foreground'>
            Selamat datang di WAWA Platform
          </p>
        </div>
        <Button asChild>
          <Link href='/portals/devices/connect'>
            <Plus className='mr-2 h-4 w-4' />
            Tambah Device
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title='Device Aktif'
          value={connectedDevices}
          description={`dari ${devices.length} total device`}
          icon={Smartphone}
          loading={devicesLoading}
          href='/portals/devices'
        />
        <StatCard
          title='Total Blast'
          value={totalBlast.toLocaleString()}
          description='pesan terkirim'
          icon={TrendingUp}
          loading={devicesLoading}
        />
        <StatCard
          title='Saldo Wallet'
          value={`Rp ${(wallet?.walletBalance || 0).toLocaleString()}`}
          description='tersedia untuk penarikan'
          icon={Wallet}
          loading={walletLoading}
          href='/portals/wallet'
        />
        <StatCard
          title='Komisi/Pesan'
          value='Rp 25'
          description='per pesan sukses'
          icon={TrendingUp}
          loading={false}
        />
      </div>

      {/* Quick Actions */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Device Terbaru</CardTitle>
            <CardDescription>Device WhatsApp yang terhubung</CardDescription>
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
              </div>
            ) : devices.length === 0 ? (
              <div className='text-center py-6 text-muted-foreground'>
                <Smartphone className='h-12 w-12 mx-auto mb-2 opacity-50' />
                <p>Belum ada device terhubung</p>
                <Button variant='outline' size='sm' className='mt-2' asChild>
                  <Link href='/portals/devices/connect'>Hubungkan Device</Link>
                </Button>
              </div>
            ) : (
              <div className='space-y-3'>
                {devices.slice(0, 3).map((device) => (
                  <div
                    key={device.id}
                    className='flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center'>
                        <Smartphone className='h-5 w-5 text-primary' />
                      </div>
                      <div>
                        <p className='font-medium'>{device.phoneNumber}</p>
                        <p className='text-xs text-muted-foreground'>
                          {device.totalBlast} pesan terkirim
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        device.status === 'CONNECTED'
                          ? 'default'
                          : device.status === 'PAIRING'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {device.status}
                    </Badge>
                  </div>
                ))}
                {devices.length > 3 && (
                  <Button variant='ghost' className='w-full' asChild>
                    <Link href='/portals/devices'>
                      Lihat semua device ({devices.length})
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Wallet</CardTitle>
            <CardDescription>Saldo dan informasi penarikan</CardDescription>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <div className='space-y-4'>
                <Skeleton className='h-16 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border'>
                  <p className='text-sm text-muted-foreground'>
                    Saldo Tersedia
                  </p>
                  <p className='text-3xl font-bold'>
                    Rp {(wallet?.walletBalance || 0).toLocaleString()}
                  </p>
                </div>
                <div className='flex gap-2'>
                  <Button className='flex-1' asChild>
                    <Link href='/portals/wallet'>
                      <Wallet className='mr-2 h-4 w-4' />
                      Tarik Dana
                    </Link>
                  </Button>
                  <Button variant='outline' className='flex-1' asChild>
                    <Link href='/portals/wallet'>Riwayat</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
