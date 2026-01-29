'use client';

import { useSession } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email(),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .optional()
    .or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function PortalProfilePage() {
  const queryClient = useQueryClient();
  const { data: sessionData, isPending: isSessionPending } = useSession();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  // Fetch Profile Data
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setValue('name', profile.name);
      setValue('email', profile.email);
    }
  }, [profile, setValue]);

  // Update Profile Mutation
  const mutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          ...(data.password ? { password: data.password } : {}),
        }),
      });

      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      reset({ ...profile, password: '' });
      // Force reload to update session info immediately
      window.location.reload();
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    mutation.mutate(data);
  };

  if (isLoading || isSessionPending) {
    return (
      <div className='flex h-[50vh] items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-xl font-bold text-gray-900 dark:text-gray-100'>
          Account Settings
        </h1>
        <p className='text-muted-foreground'>
          Manage your personal information and security.
        </p>
      </div>

      <Separator />

      <Card className='border-emerald-100 dark:border-emerald-900/20 shadow-sm'>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Update your account details below.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className='space-y-4'>
            <div className='grid gap-2'>
              <Label htmlFor='name'>Full Name</Label>
              <Input
                id='name'
                placeholder='Your name'
                {...register('name')}
                className='focus-visible:ring-emerald-500'
              />
              {errors.name && (
                <p className='text-sm text-red-500'>{errors.name.message}</p>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                disabled
                className='bg-muted'
                {...register('email')}
              />
              <p className='text-xs text-muted-foreground'>
                Email address is managed by administrator.
              </p>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='password'>New Password</Label>
              <Input
                id='password'
                type='password'
                placeholder='Enter new password to change'
                {...register('password')}
                className='focus-visible:ring-emerald-500'
              />
              {errors.password && (
                <p className='text-sm text-red-500'>
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className='flex justify-start mt-6'>
            <Button
              type='submit'
              loading={mutation.isPending}
              className='bg-emerald-600 hover:bg-emerald-700 text-white'
            >
              <Save className=' h-4 w-4' />
              Simpan
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
