import h from '@satorijs/element'
import type { SymAioHost, SymMsgGroupCtx } from '@sym-app/components'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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
        <Avatar className="sym-aio-avatar">
          <AvatarImage
            src={`${selfUrlInternal}/nekoil/v0/proxy/${msg.user?.avatar}`}
            alt={msg.user?.name}
          />
          <AvatarFallback>{msg.user?.name?.slice(0, 2)}</AvatarFallback>
        </Avatar>
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
    'nekoil:failedfwd': (_frCtx, _element) => ['[聊天记录保存失败]'],
  },
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
