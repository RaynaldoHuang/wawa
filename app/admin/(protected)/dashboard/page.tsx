'use client';

import { Card } from '@/components/ui/card';
import { Users, Smartphone, CreditCard, Activity } from 'lucide-react';

// Placeholder stats - will be fetched from API
const stats = [
  {
    title: 'Total Users',
    value: '—',
    icon: Users,
    description: 'Active users in the system',
  },
  {
    title: 'Connected Devices',
    value: '—',
    icon: Smartphone,
    description: 'WhatsApp numbers online',
  },
  {
    title: 'Pending Withdrawals',
    value: '—',
    icon: CreditCard,
    description: 'Awaiting approval',
  },
  {
    title: 'Messages Today',
    value: '—',
    icon: Activity,
    description: 'Successfully sent',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Dashboard</h1>
        <p className='text-muted-foreground'>Welcome to the WAWA Admin Panel</p>
      </div>

      {/* Stats Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {stats.map((stat) => (
          <Card key={stat.title} className='p-6'>
            <div className='flex items-center gap-4'>
              <div className='rounded-lg bg-primary/10 p-3'>
                <stat.icon className='h-6 w-6 text-primary' />
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  {stat.title}
                </p>
                <p className='text-2xl font-bold'>{stat.value}</p>
                <p className='text-xs text-muted-foreground'>
                  {stat.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card className='p-6'>
          <h2 className='text-lg font-semibold mb-4'>Quick Actions</h2>
          <div className='space-y-3'>
            <p className='text-sm text-muted-foreground'>
              • Review pending withdrawal requests
            </p>
            <p className='text-sm text-muted-foreground'>
              • Monitor device connection status
            </p>
            <p className='text-sm text-muted-foreground'>
              • Update commission rates
            </p>
          </div>
        </Card>

        <Card className='p-6'>
          <h2 className='text-lg font-semibold mb-4'>System Health</h2>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Database</span>
              <span className='text-sm text-green-500 font-medium'>
                Healthy
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Redis</span>
              <span className='text-sm text-green-500 font-medium'>
                Connected
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>WA Sessions</span>
              <span className='text-sm text-muted-foreground'>—</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
