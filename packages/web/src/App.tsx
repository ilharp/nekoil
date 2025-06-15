import { SymProvider } from '@sym-app/components'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Banned } from './pages/Banned'
import { ContentPack } from './pages/ContentPack'
import { Dash } from './pages/Dash'
import { UpgradeApp } from './pages/UpgradeApp'

const router = createBrowserRouter([
  {
    index: true,
    Component: Dash,
  },
  {
    path: ':cpHandleQuery',
    Component: ContentPack,
  },
  {
    path: 'upgradeapp',
    Component: UpgradeApp,
  },
  {
    path: 'banned',
    Component: Banned,
  },
])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: 3,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
})

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <SymProvider className="sym-aio-msg-solidheader">
      <RouterProvider router={router} />
    </SymProvider>
  </QueryClientProvider>
)
