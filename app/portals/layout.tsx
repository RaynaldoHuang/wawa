'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Smartphone,
  Wallet,
  Settings,
  LogOut,
  ChevronDown,
  User,
} from 'lucide-react';
// ... imports ...

import Image from 'next/image';
import logo from '@/public/webp/logo.webp';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useSession, signOut } from '@/lib/auth-client';
// cn removed

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/portals',
  },
  {
    title: 'Devices',
    icon: Smartphone, // Still used in menuItems
    href: '/portals/devices',
  },
  {
    title: 'Wallet',
    icon: Wallet,
    href: '/portals/wallet',
  },
  // {
  //   title: 'Settings',
  //   icon: Settings,
  //   href: '/portals/settings',
  // },
];

function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/auth/login';
  };

  return (
    <Sidebar variant='inset'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link href='/portals'>
                <div className='flex items-center justify-center'>
                  <Image
                    src={logo}
                    alt='WAWA Logo'
                    width={32}
                    height={32}
                    className='w-8 h-8 object-contain'
                  />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>WAWA</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    WhatsApp Blast
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
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
                    <AvatarFallback className='rounded-lg'>
                      {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='truncate font-semibold'>
                      {session?.user?.name || 'User'}
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
                  <Link href='/portals/profile'>
                    <User className='mr-2 h-4 w-4' />
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

export default function PortalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  React.useEffect(() => {
    if (!isPending && session?.user && (session.user as any).role === 'ADMIN') {
      router.replace('/admin/dashboard');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return null; // or a loading spinner
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className='relative overflow-hidden'>
        {/* Background Gradients */}
        <div
          className='fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 pointer-events-none'
          style={{
            background: 'radial-gradient(circle, #E6F56A 0%, transparent 65%)',
          }}
        />
        <div
          className='fixed right-[-10%] top-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 pointer-events-none'
          style={{
            background: 'radial-gradient(circle, #CFE8E3 0%, transparent 65%)',
          }}
        />

        <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4 relative z-10 bg-background/50 backdrop-blur-sm'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
        </header>
        <main className='flex-1 overflow-auto p-6 relative z-10'>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
