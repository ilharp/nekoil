import type { Context } from 'koishi'
import type { NekoilCpCpDelRequest, NekoilCpCpGetRequest } from 'nekoil-typedef'
import { CP_DELETED_REASON } from 'nekoil-typedef'
import type { Config } from '../config'
import type { NekoilUser } from '../services/user'
import { setHeader } from '../utils'
import { middlewareProxyToken } from '../utils/middlewares'
import { MANUAL_DELETE_ENABLED } from './service'

export const name = 'nekoil-cp-controller'

export const inject = ['server', 'nekoilCp', 'nekoilUser', 'nekoilTg']

export const apply = (ctx: Context, config: Config) => {
  const l = ctx.logger('nekoilCpController')

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

  ctx.server.post(
    '/nekoil/v0/cp/cp.get',
    (c, next) => {
      c.status = 200
      setHeader(c)
      c.set('Content-Type', 'application/json')
      c.flushHeaders()

      return next()
    },
    middlewareProxyToken(config),
    ctx.nekoilTg.middlewareInitData(),
    async (c) => {
      // const user = await ctx.nekoilUser.getUser(platform, pid)

      const body = c.request.body as NekoilCpCpGetRequest

      c.body = await ctx.nekoilCp.cpGet(
        undefined as unknown as NekoilUser,
        body.query,
        true,
      )
    },
  )

  ctx.server.options('/nekoil/v0/cp/cp.del', (c) => {
    c.status = 200
    setHeader(c)
    c.set('Allow', 'POST,OPTIONS')
    c.flushHeaders()
    c.body = Buffer.allocUnsafe(0)
  })

  ctx.server.post(
    '/nekoil/v0/cp/cp.del',
    (c, next) => {
      c.status = 200
      setHeader(c)
      c.set('Content-Type', 'application/json')
      c.flushHeaders()

      return next()
    },
    middlewareProxyToken(config),
    ctx.nekoilTg.middlewareInitData(),
    async (c) => {
      if (!MANUAL_DELETE_ENABLED) {
        c.body = {
          code: 2005,
          msg: 'EXXXXX NOT AVAILABLE',
        }
        return
      }

      const body = c.request.body as NekoilCpCpDelRequest

      if (!body.query) {
        c.body = {
          code: 500,
          msg: 'EXXXXX INTERNAL SERVER ERROR',
        }
        return
      }

      const user = await ctx.nekoilUser.getUser('telegram', String(c.tgUser.id))

      const target = await ctx.nekoilCp.getCpByHandle(body.query)

      if (!target) {
        c.body = {
          code: 3001,
          msg: 'EXXXXX NOT FOUND',
        }
        return
      }

      if (target.owner !== user.cordisUser.id) {
        c.body = {
          code: 2006,
          msg: 'EXXXXX FORBIDDEN',
        }
        return
      }

      const reason = CP_DELETED_REASON.USER

      try {
        await ctx.nekoilCp.cpDeleteByCpid(
          target.cpid,
          reason,
          `tg web user ${user.cordisUser.id} (pid ${c.tgUser.id})`,
        )
      } catch (e) {
        l.error(`cp.del failed, query ${body.query}`)
        l.error(e)

        c.body = {
          code: 500,
          msg: 'EXXXXX INTERNAL SERVER ERROR',
        }
        return
      }

      c.body = {
        code: 200,
      }
    },
  )
}
