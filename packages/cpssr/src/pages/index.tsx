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

interface Props {
  data: ContentPackWithFull
}

export default function Page({ data }: Props) {
  return (
    <SymProvider>
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
            <SymMsgVirtualList />
          </SymMsgGroupContext>
        </SymAioCtxContext.Provider>
      </SymAioHostContext>
    </SymProvider>
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
    },
  }
}) satisfies GetServerSideProps<Props>

const symAioHost: SymAioHost = {
  frCanRemoveBubble: () => false,
  frRenderers: {
    ...frRenderers,
  },
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
