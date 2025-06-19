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
import type { ContentPackWithFull } from 'nekoil-typedef'
import type { GetServerSideProps } from 'next'
import { useMemo } from 'react'

import styles from './index.module.scss'

interface Props {
  data: ContentPackWithFull
  selfUrlInternal: string
}

// eslint-disable-next-line import/no-default-export
export default function Page({ data, selfUrlInternal }: Props) {
  const symAioHost = useMemo<SymAioHost>(
    () => ({
      ...baseSymAioHost,
      frRenderers: {
        ...baseSymAioHost.frRenderers,
        img: (_frCtx, element) => [
          <img
            width={`${element.attrs.width}px`}
            src={`${selfUrlInternal}/nekoil/v0/proxy/${element.attrs.src}`}
          />,
        ],
      },
    }),
    [selfUrlInternal],
  )

  return (
    <div className={styles.outerContainer}>
      <div id="cpimgr-capture" className={styles.innerContainer}>
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
