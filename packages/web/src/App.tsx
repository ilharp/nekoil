import { SymProvider } from '@sym-app/components'
import type { OmitKeyof } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createStore, del, get, set } from 'idb-keyval'
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
      staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      retry: 3,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
})

export function createIDBPersister() {
  const store = createStore('nekoil_v1', 'rq_v1')

  return {
    persistClient: async (client: PersistedClient) => {
      await set('rq', client, store)
    },
    restoreClient: async () => {
      return await get<PersistedClient>('rq', store)
    },
    removeClient: async () => {
      await del('rq', store)
    },
  } satisfies Persister
}

const persister = createIDBPersister()

const persistOptions: OmitKeyof<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: 'rq_v1',
}

export const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={persistOptions}
  >
    <SymProvider className="sym-aio-msg-solidheader">
      <RouterProvider router={router} />
    </SymProvider>
  </PersistQueryClientProvider>
)
