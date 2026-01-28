'use client';

import { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchInterval: false,
    },
  },
});

const AppProvider = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
};
export default AppProvider;
