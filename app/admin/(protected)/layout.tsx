'use client';

import {
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { signOut, useSession } from '@/lib/auth-client';

const adminMenuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
  },
  {
    title: 'Users & Staff',
    icon: Users,
    href: '/admin/users',
  },
  {
    title: 'Devices',
    icon: Smartphone,
    href: '/admin/devices',
  },
  {
    title: 'Payments',
    icon: CreditCard,
    href: '/admin/payments',
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/admin/settings',
  },
];

function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut();
    router.push('/admin/auth/login');
  };

  return (
    <Sidebar variant='sidebar'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link href='/admin/dashboard'>
                <div className='flex items-center justify-center bg-black rounded-lg p-1.5'>
                  <ShieldCheck className='w-5 h-5 text-white' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>WAWA Admin</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    Control Panel
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(item.href + '/')
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarImage
                      src={session?.user?.image || ''}
                      alt={session?.user?.name || ''}
                    />
                    <AvatarFallback className='rounded-lg bg-black text-white'>
                      {session?.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='truncate font-semibold'>
                      {session?.user?.name || 'Admin'}
                    </span>
                    <span className='truncate text-xs text-muted-foreground'>
                      {session?.user?.email || ''}
                    </span>
                  </div>
                  <ChevronDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href='/admin/profile'>
                    <Settings className='mr-2 h-4 w-4' />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className='mr-2 h-4 w-4' />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  React.useEffect(() => {
    if (!isPending && session?.user && (session.user as any).role !== 'ADMIN') {
      router.replace('/portals');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return null; // or a loading spinner
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className='relative overflow-hidden'>
        {/* Background Gradients - Admin themed */}
        <div
          className='fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-15 pointer-events-none'
          style={{
            background: 'radial-gradient(circle, #1a1a1a 0%, transparent 65%)',
          }}
        />
        <div
          className='fixed right-[-10%] top-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-15 pointer-events-none'
          style={{
            background: 'radial-gradient(circle, #334155 0%, transparent 65%)',
          }}
        />

        <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4 relative z-10  backdrop-blur-sm bg-white'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
          <div className='flex items-center gap-2'>
            <ShieldCheck className='h-5 w-5' />
            <span className='font-semibold'>Admin Panel</span>
          </div>
        </header>
        <main className='flex-1 overflow-auto p-6 relative z-10 bg-white'>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
