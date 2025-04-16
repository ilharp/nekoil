import type { SymAioHost, SymMsgGroupCtx } from '@sym-app/components'
import {
  frRenderers,
  SymAioCtxContext,
  SymAioHostContext,
  SymMsgGroupContext,
  SymMsgVirtualList,
  SymProvider,
} from '@sym-app/components'
import { useState } from 'react'
import { Splash } from '../../components/Splash'
import { ContentPackWithFull } from 'nekoil-typedef'

export const ContentPack = () => {
  const [loading, setLoading] = useState(true)
  const [cp, setCp] = useState<ContentPackWithFull | undefined>(undefined)

  if (loading) return <Splash />

  return (
    <SymProvider>
      <SymAioHostContext value={symAioHost}>
        <SymAioCtxContext.Provider
          value={{
            messages: cp!.full.messages,
          }}
        >
          <SymMsgGroupContext value={symMsgGroupCtx}>
            <SymMsgVirtualList />
          </SymMsgGroupContext>
        </SymAioCtxContext.Provider>
      </SymAioHostContext>
    </SymProvider>
  )
}

const symAioHost: SymAioHost = {
  frCanRemoveBubble: () => false,
  frRenderers: {
    ...frRenderers,
  },
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
