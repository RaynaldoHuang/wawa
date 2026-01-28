'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    await signIn.email(
      {
        email: values.email,
        password: values.password,
      },
      {
        onSuccess: async () => {
          // Check if user is actually admin
          // For security, strict checks should be on server/middleware, here is just UI redirection
          // We can check session using useSession hook but here we just redirect
          toast.success('Admin Login successful');
          router.push('/admin/dashboard'); // Assuming admin dashboard exists
          router.refresh();
        },
        onError: (ctx) => {
          toast.error(ctx.error.message);
          setIsLoading(false);
        },
      },
    );
  }

  return (
    <div className='flex min-h-screen items-center justify-center p-4 bg-gray-50'>
      <div className='w-full max-w-sm space-y-6 bg-white p-8 rounded-xl shadow-md'>
        <div className='space-y-2 text-center flex flex-col items-center'>
          <div className='h-12 w-12 bg-black text-white rounded-full flex items-center justify-center mb-4'>
            <ShieldCheck className='h-6 w-6' />
          </div>
          <h1 className='text-2xl font-bold'>Admin Portal</h1>
          <p className='text-gray-500'>Secure access for administrators</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder='admin@ciptacode.com' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Authenticating...
                </>
              ) : (
                'Admin Sign In'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
