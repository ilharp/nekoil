import type { SymAioHost, SymMsgGroupCtx } from '@sym-app/components'
import {
  frRenderers,
  SymAioCtxContext,
  SymAioHostContext,
  SymMsgGroupContext,
  SymMsgVirtualList,
  SymProvider,
} from '@sym-app/components'
import { useQuery } from '@tanstack/react-query'
import type { ContentPackWithFull, NekoilCpCpGetRequest } from 'nekoil-typedef'
import { useParams } from 'react-router'
import { ResultError } from '../../components/ResultError'
import { Splash } from '../../components/Splash'
import { requestV1 } from '../../utils'
import h from '@satorijs/element'

import styles from './index.module.scss'
import { FRImg } from '../../components/frs/FRImg'

export const ContentPack = () => {
  const { cpHandleQuery } = useParams()

  const { isPending, isError, data, error } = useQuery({
    queryKey: ['cp', cpHandleQuery],
    queryFn: requestV1<ContentPackWithFull>('/nekoil/v0/cp/cp.get', {
      body: JSON.stringify({
        query: cpHandleQuery!,
      } satisfies NekoilCpCpGetRequest),
    }),
  })

  if (isPending) return <Splash />

  if (isError) return <ResultError e={error} />

  return (
    <SymProvider className={styles.symProvider}>
      <SymAioHostContext value={symAioHost}>
        <SymAioCtxContext.Provider
          value={{
            messages: data.full.messages.map((x) => ({
              ...x,
              symHeader: x.user?.name,
              elements: h.parse(x.content!),
            })),
          }}
        >
          <SymMsgGroupContext value={symMsgGroupCtx}>
            <div className={styles.container}>
              <div className={styles.headerContainer}>
                <h1 className={styles.title}>{data.summary.title}</h1>
              </div>
              <SymMsgVirtualList className={styles.msgList} />
            </div>
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
    img: (_frCtx, element) => [<FRImg elem={element} />],
  },
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
