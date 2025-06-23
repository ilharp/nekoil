import type { Context } from 'koishi'
import type { Config } from '../config'
// import { setHeader } from '../utils'
// import { middlewareProxyToken } from '../utils/middlewares'

export const name = 'nekoil-sch-controller'

export const inject = ['server', 'nekoilSch', 'nekoilTg']

export const apply = (_ctx: Context, _config: Config) => {
  // const l = ctx.logger('nekoilCpController')
  //
  // ctx.server.options('/nekoil/v0/sch/sch.get', (c) => {
  //   c.status = 200
  //   setHeader(c)
  //   c.set('Allow', 'GET,HEAD,POST,OPTIONS')
  //   c.flushHeaders()
  //   c.body = Buffer.allocUnsafe(0)
  // })
  //
  // ctx.server.head('/nekoil/v0/sch/sch.get', (c) => {
  //   c.status = 200
  //   setHeader(c)
  //   c.flushHeaders()
  //   c.body = Buffer.allocUnsafe(0)
  // })
  //
  // ctx.server.get('/nekoil/v0/sch/sch.get', (c) => {
  //   c.status = 405
  //   setHeader(c)
  //   c.flushHeaders()
  //   c.body = Buffer.allocUnsafe(0)
  // })
  //
  // ctx.server.post(
  //   '/nekoil/v0/sch/sch.get',
  //   (c, next) => {
  //     c.status = 200
  //     setHeader(c)
  //     c.set('Content-Type', 'application/json')
  //     c.flushHeaders()
  //
  //     return next()
  //   },
  //   middlewareProxyToken(config),
  //   ctx.nekoilTg.middlewareInitData(),
  //   async (c) => {},
  // )
}
