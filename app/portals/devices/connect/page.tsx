'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Keyboard, ArrowLeft, Loader2, Check, X } from 'lucide-react';
import QRCodeSVG from 'qrcode';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PairingMethod = 'qr' | 'code' | null;
type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'pairing'
  | 'connected'
  | 'failed';

export default function ConnectDevicePage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [pairingMethod, setPairingMethod] = React.useState<PairingMethod>(null);
  const [status, setStatus] = React.useState<ConnectionStatus>('idle');
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [pairingCode, setPairingCode] = React.useState<string | null>(null);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const pollRef = React.useRef<NodeJS.Timeout | null>(null);

  const startConnection = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Masukkan nomor telepon yang valid');
      return;
    }

    setStatus('connecting');

    try {
      const res = await fetch('/api/devices/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phoneNumber: phoneNumber.startsWith('0')
            ? '62' + phoneNumber.slice(1)
            : phoneNumber,
          usePairingCode: pairingMethod === 'code',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menghubungkan device');
        setStatus('failed');
        return;
      }

      setDeviceId(data.deviceId);

      if (data.status === 'CONNECTED') {
        setStatus('connected');
        toast.success('Device berhasil terhubung!');
        setTimeout(() => router.push('/portals/devices'), 1500);
        return;
      }

      setStatus('pairing');

      if (pairingMethod === 'qr' && data.qr) {
        // Generate QR code image
        const qrDataUrl = await QRCodeSVG.toDataURL(data.qr, {
          width: 256,
          margin: 2,
        });
        setQrCode(qrDataUrl);
      } else if (pairingMethod === 'code' && data.pairingCode) {
        setPairingCode(data.pairingCode);
      }

      // Start polling for status
      startPolling(data.deviceId);
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Terjadi kesalahan');
      setStatus('failed');
    }
  };

  const startPolling = (id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/devices/${id}/status`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (data.status === 'CONNECTED') {
          setStatus('connected');
          toast.success('Device berhasil terhubung!');
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => router.push('/portals/devices'), 1500);
        } else if (data.qr && pairingMethod === 'qr') {
          const qrDataUrl = await QRCodeSVG.toDataURL(data.qr, {
            width: 256,
            margin: 2,
          });
          setQrCode(qrDataUrl);
        } else if (data.pairingCode && pairingMethod === 'code') {
          setPairingCode(data.pairingCode);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);
  };

  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const reset = () => {
    setPhoneNumber('');
    setPairingMethod(null);
    setStatus('idle');
    setQrCode(null);
    setPairingCode(null);
    setDeviceId(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  return (
    <div className='max-w-2xl mx-auto space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' onClick={() => router.back()}>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            Hubungkan Device
          </h1>
          <p className='text-muted-foreground'>Tambahkan nomor WhatsApp baru</p>
        </div>
      </div>

      {/* Step 1: Phone Number */}
      {status === 'idle' && !pairingMethod && (
        <Card>
          <CardHeader>
            <CardTitle>Masukkan Nomor Telepon</CardTitle>
            <CardDescription>
              Nomor WhatsApp yang akan dihubungkan
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Input
              type='tel'
              placeholder='08123456789'
              value={phoneNumber}
              onChange={(e) =>
                setPhoneNumber(e.target.value.replace(/\D/g, ''))
              }
              className='text-lg'
            />
            <p className='text-sm text-muted-foreground'>
              Contoh: 08123456789 atau 628123456789
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose Method */}
      {status === 'idle' && !pairingMethod && phoneNumber.length >= 10 && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih Metode Pairing</CardTitle>
            <CardDescription>
              Cara menghubungkan device WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-4'>
            <button
              onClick={() => setPairingMethod('qr')}
              className='p-6 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all text-center group'
            >
              <QrCode className='h-12 w-12 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors' />
              <p className='font-semibold'>QR Code</p>
              <p className='text-sm text-muted-foreground mt-1'>
                Scan QR dari aplikasi WhatsApp
              </p>
            </button>
            <button
              onClick={() => setPairingMethod('code')}
              className='p-6 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all text-center group'
            >
              <Keyboard className='h-12 w-12 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors' />
              <p className='font-semibold'>Pairing Code</p>
              <p className='text-sm text-muted-foreground mt-1'>
                Masukkan kode 8 digit di WhatsApp
              </p>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Confirm Connection */}
      {status === 'idle' && pairingMethod && (
        <Card>
          <CardHeader>
            <CardTitle>Konfirmasi</CardTitle>
            <CardDescription>
              Hubungkan {phoneNumber} menggunakan{' '}
              {pairingMethod === 'qr' ? 'QR Code' : 'Pairing Code'}
            </CardDescription>
          </CardHeader>
          <CardContent className='flex gap-2'>
            <Button variant='outline' onClick={reset}>
              Ubah
            </Button>
            <Button onClick={startConnection} className='flex-1'>
              Mulai Pairing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connecting */}
      {status === 'connecting' && (
        <Card>
          <CardContent className='py-12 text-center'>
            <Loader2 className='h-12 w-12 animate-spin mx-auto mb-4 text-primary' />
            <p className='font-semibold'>Menghubungkan...</p>
            <p className='text-muted-foreground'>Mohon tunggu sebentar</p>
          </CardContent>
        </Card>
      )}

      {/* QR Code */}
      {status === 'pairing' && pairingMethod === 'qr' && (
        <Card>
          <CardHeader className='text-center'>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>
              Buka WhatsApp &gt; Menu &gt; Linked Devices &gt; Link a Device
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col items-center'>
            {qrCode ? (
              <div className='p-4 bg-white rounded-xl shadow-lg'>
                <img src={qrCode} alt='QR Code' className='w-64 h-64' />
              </div>
            ) : (
              <div className='w-64 h-64 bg-muted rounded-xl flex items-center justify-center'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              </div>
            )}
            <p className='text-sm text-muted-foreground mt-4'>
              QR akan refresh otomatis
            </p>
            <Button variant='outline' onClick={reset} className='mt-4'>
              Batal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pairing Code */}
      {status === 'pairing' && pairingMethod === 'code' && (
        <Card>
          <CardHeader className='text-center'>
            <CardTitle>Masukkan Pairing Code</CardTitle>
            <CardDescription>
              Buka WhatsApp &gt; Menu &gt; Linked Devices &gt; Link with phone
              number
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col items-center'>
            {pairingCode ? (
              <div className='flex gap-2'>
                {pairingCode.split('').map((digit, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-12 h-14 flex items-center justify-center text-2xl font-bold rounded-lg bg-muted',
                      i === 3 && 'ml-4',
                    )}
                  >
                    {digit}
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex gap-2'>
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-12 h-14 bg-muted rounded-lg animate-pulse',
                      i === 3 && 'ml-4',
                    )}
                  />
                ))}
              </div>
            )}
            <p className='text-sm text-muted-foreground mt-4'>
              Kode akan refresh otomatis
            </p>
            <Button variant='outline' onClick={reset} className='mt-4'>
              Batal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connected */}
      {status === 'connected' && (
        <Card className='border-green-500/50 bg-green-500/5'>
          <CardContent className='py-12 text-center'>
            <div className='h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4'>
              <Check className='h-8 w-8 text-green-500' />
            </div>
            <p className='font-semibold text-lg'>Berhasil Terhubung!</p>
            <p className='text-muted-foreground'>
              Mengalihkan ke halaman devices...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {status === 'failed' && (
        <Card className='border-destructive/50 bg-destructive/5'>
          <CardContent className='py-12 text-center'>
            <div className='h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4'>
              <X className='h-8 w-8 text-destructive' />
            </div>
            <p className='font-semibold text-lg'>Gagal Menghubungkan</p>
            <p className='text-muted-foreground mb-4'>Silakan coba lagi</p>
            <Button onClick={reset}>Coba Lagi</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
