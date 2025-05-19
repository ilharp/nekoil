/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import type {} from '@koishijs/plugin-server'
import { createProxyServer } from 'http-proxy'
import type { Context } from 'koishi'
import type { Config } from '../config'
import { setHeader } from '../utils'

export const name = 'nekoil-assets-controller'

export const inject = ['server', 'nekoilCp', 'nekoilUser', 'nekoilAssets']

export const apply = (ctx: Context, config: Config) => {
  // const l = ctx.logger('nekoilAssetsController')

  const proxy = createProxyServer()
  ctx.on('dispose', () => {
    proxy.close()
  })

  ctx.server.all(
    '/nekoil/v0/proxy/internal\\:nekoil/2/:filename+',
    async (c, next) => {
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
        c.status = 403
        return
      }

      await next()

      if (['HEAD', 'GET'].includes(c.method))
        c.set('Cache-Control', 'public, max-age=60') // 1800
    },
    (c) => {
      if (c.method === 'OPTIONS') {
        c.status = 200
        setHeader(c)
        c.set('Allow', 'GET,HEAD,OPTIONS')
        c.flushHeaders()
        c.body = Buffer.allocUnsafe(0)
        return
      } else {
        const filename = c.params['filename']!

        c.req.url = `/v1/${filename}`
        ;(
          c.req as unknown as {
            body: unknown
          }
        ).body = c.request.body || null

        return new Promise<void>((resolve) => {
          // https://github.com/nodejitsu/node-http-proxy/issues/951#issuecomment-179904134
          c.res.on('close', () => {
            // Sliently ignore close event.
            resolve()
          })

          c.res.on('finish', () => {
            resolve()
          })

          proxy.web(
            c.req,
            c.res,
            {
              target: config.assets.endpoint,
              changeOrigin: true,
            },
            (e) => {
              const status = (
                {
                  ECONNREFUSED: 503,
                  ETIMEOUT: 504,
                } as const
              )[
                (
                  e as unknown as {
                    code: number
                  }
                ).code
              ]
              c.status = status || 500
              resolve()
            },
          )
        })
      }
    },
  )
}
