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
    path: ':cphandle',
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

const queryClient = new QueryClient()

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)
