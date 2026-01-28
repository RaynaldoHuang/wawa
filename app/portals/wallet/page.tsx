'use client';

import {
  ArrowDownToLine,
  Building,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface WalletData {
  walletBalance: number;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankName: string;
  accountNum: string;
  accountName: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'REJECTED';
  createdAt: string;
  processedAt?: string;
}

export default function WalletPage() {
  const [wallet, setWallet] = React.useState<WalletData | null>(null);
  const [withdrawals, setWithdrawals] = React.useState<Withdrawal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);
  const [bankDialogOpen, setBankDialogOpen] = React.useState(false);
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Bank form state
  const [bankName, setBankName] = React.useState('');
  const [bankAccount, setBankAccount] = React.useState('');
  const [bankHolder, setBankHolder] = React.useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [walletRes, withdrawalsRes] = await Promise.all([
        fetch('/api/wallet', { credentials: 'include' }),
        fetch('/api/withdrawals', { credentials: 'include' }),
      ]);

      const walletData = await walletRes.json();
      const withdrawalsData = await withdrawalsRes.json();

      setWallet(walletData);
      setWithdrawals(withdrawalsData);

      // Set bank form defaults
      setBankName(walletData.bankName || '');
      setBankAccount(walletData.bankAccount || '');
      setBankHolder(walletData.bankHolder || '');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleSaveBank = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/bank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bankName, bankAccount, bankHolder }),
      });

      if (res.ok) {
        toast.success('Data bank berhasil disimpan');
        setWallet((prev) =>
          prev ? { ...prev, bankName, bankAccount, bankHolder } : prev,
        );
        setBankDialogOpen(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Gagal menyimpan data bank');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (isNaN(amount) || amount < 50000) {
      toast.error('Minimum penarikan Rp 50.000');
      return;
    }
    if (amount > (wallet?.walletBalance || 0)) {
      toast.error('Saldo tidak mencukupi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount }),
      });

      if (res.ok) {
        const withdrawal = await res.json();
        toast.success('Penarikan berhasil diajukan');
        setWithdrawals((prev) => [withdrawal, ...prev]);
        setWallet((prev) =>
          prev ? { ...prev, walletBalance: prev.walletBalance - amount } : prev,
        );
        setWithdrawDialogOpen(false);
        setWithdrawAmount('');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Gagal mengajukan penarikan');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Withdrawal['status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <Badge className='bg-green-500/10 text-green-500 border-green-500/20'>
            <CheckCircle2 className='mr-1 h-3 w-3' />
            Sukses
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant='secondary'>
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            Diproses
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant='destructive'>
            <XCircle className='mr-1 h-3 w-3' />
            Ditolak
          </Badge>
        );
      default:
        return (
          <Badge variant='outline'>
            <Clock className='mr-1 h-3 w-3' />
            Pending
          </Badge>
        );
    }
  };

  const fee = 2500;
  const minWithdraw = 50000;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Wallet</h1>
        <p className='text-muted-foreground'>Kelola saldo dan penarikan dana</p>
      </div>

      {/* Balance Card */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card className='relative overflow-hidden'>
          <div className='absolute inset-0 bg-linear-to-br from-primary/20 via-primary/10 to-transparent' />
          <CardHeader className='relative'>
            <CardDescription>Saldo Tersedia</CardDescription>
            <CardTitle className='text-4xl'>
              {loading ? (
                <Skeleton className='h-10 w-48' />
              ) : (
                `Rp ${(wallet?.walletBalance || 0).toLocaleString()}`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className='relative flex gap-2'>
            <Dialog
              open={withdrawDialogOpen}
              onOpenChange={setWithdrawDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  disabled={
                    !wallet?.bankName ||
                    (wallet?.walletBalance || 0) < minWithdraw
                  }
                >
                  <ArrowDownToLine className='mr-2 h-4 w-4' />
                  Tarik Dana
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tarik Dana</DialogTitle>
                  <DialogDescription>
                    Transfer ke rekening {wallet?.bankName} -{' '}
                    {wallet?.bankAccount}
                  </DialogDescription>
                </DialogHeader>
                <div className='space-y-4 py-4'>
                  <div>
                    <label className='text-sm font-medium'>
                      Jumlah Penarikan
                    </label>
                    <Input
                      type='number'
                      placeholder='Masukkan jumlah'
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className='mt-1'
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      Minimum Rp {minWithdraw.toLocaleString()}
                    </p>
                  </div>
                  {withdrawAmount &&
                    parseInt(withdrawAmount) >= minWithdraw && (
                      <div className='p-4 rounded-lg bg-muted space-y-2 text-sm'>
                        <div className='flex justify-between'>
                          <span>Jumlah</span>
                          <span>
                            Rp {parseInt(withdrawAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className='flex justify-between text-muted-foreground'>
                          <span>Biaya Admin</span>
                          <span>- Rp {fee.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className='flex justify-between font-semibold'>
                          <span>Total Diterima</span>
                          <span>
                            Rp{' '}
                            {(parseInt(withdrawAmount) - fee).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => setWithdrawDialogOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button onClick={handleWithdraw} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Memproses...
                      </>
                    ) : (
                      'Tarik Dana'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Bank Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Building className='h-5 w-5' />
              Rekening Bank
            </CardTitle>
            <CardDescription>Rekening untuk penarikan dana</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className='space-y-2'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-48' />
              </div>
            ) : wallet?.bankName ? (
              <div className='space-y-1'>
                <p className='font-medium'>{wallet.bankName}</p>
                <p className='text-muted-foreground'>{wallet.bankAccount}</p>
                <p className='text-sm text-muted-foreground'>
                  a.n. {wallet.bankHolder}
                </p>
              </div>
            ) : (
              <p className='text-muted-foreground text-sm'>
                Belum ada rekening terdaftar
              </p>
            )}
            <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
              <DialogTrigger asChild>
                <Button variant='outline' size='sm' className='mt-4'>
                  <CreditCard className='mr-2 h-4 w-4' />
                  {wallet?.bankName ? 'Ubah Rekening' : 'Tambah Rekening'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rekening Bank</DialogTitle>
                  <DialogDescription>
                    Masukkan data rekening untuk penarikan
                  </DialogDescription>
                </DialogHeader>
                <div className='space-y-4 py-4'>
                  <div>
                    <label className='text-sm font-medium'>Nama Bank</label>
                    <Input
                      placeholder='BCA, BNI, Mandiri, dll'
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <label className='text-sm font-medium'>
                      Nomor Rekening
                    </label>
                    <Input
                      placeholder='1234567890'
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <label className='text-sm font-medium'>
                      Nama Pemilik Rekening
                    </label>
                    <Input
                      placeholder='Nama lengkap sesuai rekening'
                      value={bankHolder}
                      onChange={(e) => setBankHolder(e.target.value)}
                      className='mt-1'
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => setBankDialogOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button onClick={handleSaveBank} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Menyimpan...
                      </>
                    ) : (
                      'Simpan'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <History className='h-5 w-5' />
            Riwayat Penarikan
          </CardTitle>
          <CardDescription>Daftar penarikan dana Anda</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='space-y-3'>
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <Wallet className='h-12 w-12 mx-auto mb-2 opacity-50' />
              <p>Belum ada riwayat penarikan</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className='flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
                >
                  <div>
                    <div className='flex items-center gap-2'>
                      <p className='font-medium'>
                        Rp {w.amount.toLocaleString()}
                      </p>
                      {getStatusBadge(w.status)}
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {w.bankName} - {w.accountNum}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {new Date(w.createdAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm text-muted-foreground'>Diterima</p>
                    <p className='font-semibold'>
                      Rp {w.netAmount.toLocaleString()}
                    </p>
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
