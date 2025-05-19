import type {} from '@koishijs/plugin-server'
import type { Context } from 'koishi'
import type { NekoilCpCpGetRequest } from 'nekoil-typedef'
import type { Config } from '../config'
import type { NekoilUser } from '../services/user'
import { setHeader } from '../utils'

export const name = 'nekoil-cp-controller'

export const inject = ['server', 'nekoilCp', 'nekoilUser']

export const apply = (ctx: Context, config: Config) => {
  // const l = ctx.logger('nekoilCpController')

  ctx.server.options('/nekoil/v0/cp/cp.get', (c) => {
    c.status = 200
    setHeader(c)
    c.set('Allow', 'GET,HEAD,POST,OPTIONS')
    c.flushHeaders()
    c.body = Buffer.allocUnsafe(0)
  })

  ctx.server.head('/nekoil/v0/cp/cp.get', (c) => {
    c.status = 200
    setHeader(c)
    c.flushHeaders()
    c.body = Buffer.allocUnsafe(0)
  })

  ctx.server.get('/nekoil/v0/cp/cp.get', (c) => {
    c.status = 405
    setHeader(c)
    c.flushHeaders()
    c.body = Buffer.allocUnsafe(0)
  })

  ctx.server.post('/nekoil/v0/cp/cp.get', async (c) => {
    // const user = await ctx.nekoilUser.getUser(platform, pid)

    const body = c.request.body as NekoilCpCpGetRequest

    c.status = 200
    setHeader(c)
    c.set('Content-Type', 'application/json')
    c.flushHeaders()

    const nekoilProxyToken = c.request.header['nekoil-proxy-token']
    if (
      !nekoilProxyToken ||
      Array.isArray(nekoilProxyToken) ||
      !nekoilProxyToken.length ||
      nekoilProxyToken !== config.proxyToken
    ) {
      c.body = {
        code: 2003,
        msg: 'EXXXXX FORBIDDEN',
      }
      return
    }
    const cfCountry = c.request.header['cf-ipcountry']
    if (
      !cfCountry ||
      Array.isArray(cfCountry) ||
      !cfCountry.length ||
      cfCountry === 'CN'
    ) {
      c.body = {
        code: 2002,
        msg: 'EXXXXX FORBIDDEN',
      }
      return
    }

    c.body = await ctx.nekoilCp.cpGet(
      undefined as unknown as NekoilUser,
      body.query,
      true,
    )
  })
}
