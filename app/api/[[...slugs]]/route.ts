import { Elysia, t } from 'elysia';

import { auth } from '@/lib/auth';

export const app = new Elysia({ prefix: '/api' })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      user: session?.user,
      session: session?.session,
    };
  })
  .macro({
    role: (role: 'ADMIN' | 'USER') => ({
      beforeHandle({ user }) {
        if (!user) return new Response('Unauthorized', { status: 401 });
        const userWithRole = user as typeof user & { type: string };
        if (role && userWithRole.type !== role)
          return new Response('Forbidden', { status: 403 });
      },
    }),
  })
  .get('/', () => 'Hello Nextjs')
  .post('/', ({ body }) => body, {
    body: t.Object({
      name: t.String(),
    }),
  })
  .get('/admin', () => 'Admin Secret', {
    role: 'ADMIN',
  })
  .get('/user', () => 'User Secret', {
    role: 'USER',
  });

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
export const HEAD = app.fetch;

export type App = typeof app;
