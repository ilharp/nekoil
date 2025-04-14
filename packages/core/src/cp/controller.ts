import type {} from '@koishijs/plugin-server'
import type { Context } from 'koishi'
import { setHeader } from '../utils'

export const name = 'nekoil-cp-controller'

export const inject = ['server', 'nekoilCp']

export const apply = (ctx: Context) => {
  ctx.server.post('/nekoil/v0/cp/cp.get', async (c) => {
    setHeader(c)
    c.body = await ctx.nekoilCp.cpGet()
  })
}
