import h from '@satorijs/element'
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
import { Footer } from '../../components/Footer'
import { FRImg } from '../../components/frs/FRImg'
import { ResultError } from '../../components/ResultError'
import { Splash } from '../../components/Splash'
import { requestV1 } from '../../utils'
import styles from './index.module.scss'

export const ContentPack = () => {
  const cpHandleQuery = decodeURIComponent(useParams().cpHandleQuery!)

  const { isPending, isError, data, error } = useQuery({
    queryKey: ['cp', cpHandleQuery],
    queryFn: requestV1<ContentPackWithFull>('/nekoil/v0/cp/cp.get', {
      body: JSON.stringify({
        query: cpHandleQuery,
      } satisfies NekoilCpCpGetRequest),
    }),
  })

  if (isPending) return <Splash />

  if (isError) return <ResultError e={error} />

  return (
    <SymProvider className={styles.symProvider}>
      <div className={styles.headerContainer}>
        <h1 className={styles.title}>{data.summary.title}</h1>
      </div>
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
            <SymMsgVirtualList className={styles.msgList} />
          </SymMsgGroupContext>
        </SymAioCtxContext.Provider>
      </SymAioHostContext>
      <div className="nekoil-separator" />
      <Footer />
      <div className={styles.bottomFix} />
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
