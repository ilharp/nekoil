import type {} from '@koishijs/plugin-server'
import type { Context } from 'koishi'
import type { NekoilCpCpGetRequest } from 'nekoil-typedef'
import type { NekoilUser } from '../services/user'
import { setHeader } from '../utils'

export const name = 'nekoil-cp-controller'

export const inject = ['server', 'nekoilCp', 'nekoilUser']

export const apply = (ctx: Context) => {
  const l = ctx.logger('nekoilCpController')

  ctx.server.post('/nekoil/v0/cp/cp.get', async (c) => {
    // const user = await ctx.nekoilUser.getUser(platform, pid)

    const body = c.request.body as NekoilCpCpGetRequest

    c.status = 200
    setHeader(c)
    c.flushHeaders()

    l.info(c.request.header)
    // const cfCountry = c.request.header['CF-IPCountry']
    // if (
    //   !cfCountry ||
    //   Array.isArray(cfCountry) ||
    //   !cfCountry.length ||
    //   cfCountry === 'CN'
    // ) {
    //   c.body = {
    //     code: 2002,
    //     msg: 'EXXXXX FORBIDDEN',
    //   }
    //   return
    // }

    c.body = await ctx.nekoilCp.cpGet(
      undefined as unknown as NekoilUser,
      body.query,
      true,
    )
  })
}
