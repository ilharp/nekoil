import type { ParameterizedContext } from 'koa'

export const setHeader = (c: ParameterizedContext) => {
  c.set({
    Connection: 'keep-alive',
    'Cache-Control': 'no-store',
    'X-Powered-By': 'Nekoil master-0',
  })
}
