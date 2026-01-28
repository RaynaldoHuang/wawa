'use client';

import { z } from 'zod';
import { signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from './ui/input';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const formSchema = z
  .object({
    name: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password tidak sama',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof formSchema>;

const RegisterForm = ({ className, ...props }: React.ComponentProps<'div'>) => {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  const onSubmit: SubmitHandler<RegisterFormValues> = async (data) => {
    setIsLoading(true);
    await signUp.email(
      {
        email: data.email,
        password: data.password,
        name: data.name,
      },
      {
        onSuccess: () => {
          toast.success('Register berhasil');
          router.push('/portals');
          router.refresh();
        },
        onError: (ctx) => {
          toast.error(ctx.error.message);
          setIsLoading(false);
        },
      },
    );
  };

  return (
    <div className={cn('flex flex-col gap-6 min-w-sm', className)} {...props}>
      <Card>
        <CardHeader className='text-center'>
          <CardTitle className='text-xl'>Selamat Datang!</CardTitle>
          <CardDescription>
            Daftar dengan akun Google atau Apple Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <Button variant='outline' type='button'>
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
                    <path
                      d='M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z'
                      fill='currentColor'
                    />
                  </svg>
                  Daftar dengan Google
                </Button>
              </Field>
              <FieldSeparator className='*:data-[slot=field-separator-content]:bg-card'>
                Atau masuk dengan email
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor='name'>Nama</FieldLabel>
                <Input
                  id='name'
                  type='text'
                  placeholder='Nama Lengkap'
                  {...register('name')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor='email'>Email</FieldLabel>
                <Input
                  id='email'
                  type='email'
                  placeholder='email@example.com'
                  {...register('email')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor='password'>Password</FieldLabel>
                <Input
                  id='password'
                  type='password'
                  placeholder='••••••••'
                  {...register('password')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor='confirmPassword'>
                  Konfirmasi Password
                </FieldLabel>
                <Input
                  id='confirmPassword'
                  type='password'
                  placeholder='••••••••'
                  {...register('confirmPassword')}
                />
              </Field>
              <Field>
                <Button type='submit' loading={isLoading}>
                  Daftar
                </Button>
                <FieldDescription className='text-center'>
                  Sudah punya akun? <Link href='/auth/login'>Masuk</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
export default RegisterForm;
