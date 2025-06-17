import h from '@satorijs/element'
import type { SymAioHost, SymMsgGroupCtx } from '@sym-app/components'
import {
  frRenderers,
  SymAioCtxContext,
  SymAioHostContext,
  SymMsgGroupContext,
  SymMsgVirtualList,
} from '@sym-app/components'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import type {
  ContentPackWithFull,
  NekoilCpCpGetRequest,
  NekoilSatoriUser,
} from 'nekoil-typedef'
import { useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { AioAvatar } from '../../components/AioAvatar'
import { Footer } from '../../components/Footer'
import { FRCp } from '../../components/frs/FRCp'
import { FRImg } from '../../components/frs/FRImg'
import { ResultError } from '../../components/ResultError'
import { Splash } from '../../components/Splash'
import { requestV1 } from '../../utils/request'
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

  const location = useLocation()
  const navigate = useNavigate()

  const handleBack = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    navigate(-1)
  }, [navigate])

  if (isPending) return <Splash />

  if (isError) return <ResultError e={error} />

  return (
    <>
      <div className={styles.headerContainer}>
        <h1 className={styles.title}>{data.summary.title}</h1>
        {location.key !== 'default' && (
          <div onClick={handleBack} className={styles.backBtn}>
            <ChevronLeft className={styles.backBtnIcon} />
          </div>
        )}
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
    </>
  )
}

const symAioHost: SymAioHost = {
  avatarRenderer: (msg) => <AioAvatar user={msg.user! as NekoilSatoriUser} />,
  frCanRemoveBubble: (x) => {
    if (
      x.length === 1 &&
      typeof x[0] === 'object' &&
      'type' in x[0]! &&
      x[0].type === FRCp
    )
      return true

    return false
  },
  frRenderers: {
    ...frRenderers,
    img: (_frCtx, element) => [<FRImg elem={element} />],
    'nekoil:oversizedimg': (_frCtx, _element) => ['[过大图片]'],
    'nekoil:failedimg': (_frCtx, _element) => ['[图片保存失败]'],
    'nekoil:cp': (_frCtx, element) => [<FRCp elem={element} />],
    'nekoil:failedfwd': (_frCtx, _element) => ['[聊天记录保存失败]'],
  },
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
