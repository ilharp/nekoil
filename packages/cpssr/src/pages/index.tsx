import { FRCp } from '@/components/frs/FRCp'
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
import { ArrowRight } from 'lucide-react'
import type { ContentPackWithFull } from 'nekoil-typedef'
import type { GetServerSideProps } from 'next'
import { useMemo } from 'react'

import styles from './index.module.scss'

interface Props {
  data: ContentPackWithFull
  selfUrlInternal: string
  showMoreTip: boolean
}

// eslint-disable-next-line import/no-default-export
export default function Page({ data, selfUrlInternal, showMoreTip }: Props) {
  const symAioHost = useMemo<SymAioHost>(
    () => ({
      ...baseSymAioHost,
      avatarRenderer: (msg) => (
        <div className="sym-avatar sym-aio-avatar">
          {msg.user?.avatar ? (
            <img
              className="sym-avatar-image"
              src={`${selfUrlInternal}/nekoil/v0/proxy/${msg.user.avatar}`}
            />
          ) : (
            <span className="sym-avatar-fallback">
              {msg.user?.name?.slice(0, 2)}
            </span>
          )}
        </div>
      ),
      frRenderers: {
        ...baseSymAioHost.frRenderers,
        img: (_frCtx, element) => [
          <img
            className={styles.frImg}
            width={`${element.attrs.width}px`}
            src={`${selfUrlInternal}/nekoil/v0/proxy/${element.attrs.src}`}
          />,
        ],
      },
    }),
    [selfUrlInternal],
  )

  return (
    <div id="cpimgr-capture" className={styles.outerContainer}>
      <div className={styles.innerContainer}>
        <SymProvider className="sym-aio-msg-solidheader">
          <SymAioHostContext value={symAioHost}>
            <SymAioCtxContext.Provider
              value={{
                messages: data.full.messages.map((x) => ({
                  ...x,
                  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                  symHeader: x.user?.name,
                  elements: h.parse(x.content!),
                })),
              }}
            >
              <SymMsgGroupContext value={symMsgGroupCtx}>
                <SymMsgVirtualList />
              </SymMsgGroupContext>
            </SymAioCtxContext.Provider>
          </SymAioHostContext>
        </SymProvider>
      </div>

      {showMoreTip && (
        <div className={styles.moreTipOuterContainer}>
          <div className={styles.moreTipBg} />
          <div className={styles.moreTipContentContainer}>
            <div className={styles.moreTipContent}>
              <ArrowRight className={styles.moreTipContentIcon} /> 查看{' '}
              {data.summary.count} 条聊天记录
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const getServerSideProps = (async (ctx) => {
  return {
    props: {
      data: JSON.parse(
        Buffer.from(
          ctx.req.headers['nekoil-cpssr-data'] as string,
          'base64',
        ).toString('utf-8'),
      ) as ContentPackWithFull,
      selfUrlInternal: ctx.req.headers['nekoil-selfurl-internal'] as string,
      showMoreTip: (ctx.req.headers['nekoil-showmoretip'] as string) === 'true',
    },
  }
}) satisfies GetServerSideProps<Props>

const baseSymAioHost: SymAioHost = {
  frCanRemoveBubble: () => false,
  frRenderers: {
    ...frRenderers,
    'nekoil:oversizedimg': (_frCtx, _element) => ['[过大图片]'],
    'nekoil:failedimg': (_frCtx, _element) => ['[图片保存失败]'],
    'nekoil:cp': (_frCtx, element) => [<FRCp elem={element} />],
    'nekoil:failedfwd': (_frCtx, _element) => ['[聊天记录保存失败]'],
  },
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
