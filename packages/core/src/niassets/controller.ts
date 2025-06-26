/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import type {} from '@koishijs/plugin-server'
import type { Context } from 'koishi'
import mime from 'mime'
import type { Config } from '../config'
import { setHeader } from '../utils'
import { middlewareProxyToken } from '../utils/middlewares'

export const name = 'nekoil-assets-controller'

export const inject = [
  'server',
  'nekoilCp',
  'nekoilUser',
  'nekoilAssets',
  'nekoilTg',
]

export const apply = (ctx: Context, config: Config) => {
  // const l = ctx.logger('nekoilAssetsController')

  ctx.server.all(
    '/nekoil/v0/proxy/internal\\:nekoil/2/:filename+',
    (c, next) => {
      if (c.method === 'OPTIONS') {
        c.status = 200
        setHeader(c)
        c.set('Allow', 'GET,HEAD,OPTIONS')
        c.flushHeaders()
        c.body = Buffer.allocUnsafe(0)
        return
      }

      return next()
    },
    middlewareProxyToken(config),
    async (c) => {
      const filename = c.params['filename']!
      const filenameSplit = filename.split('.')
      if (filenameSplit.length !== 2) {
        c.status = 400
        setHeader(c)
        c.flushHeaders()
        c.body = Buffer.allocUnsafe(0)
        return
      }

      const [_fileHandle, fileExt] = filenameSplit as [string, string]

      const fileRes = await ctx.nekoilAssets.get(filename)

      for (const pair of fileRes.headers)
        if (pair[0] !== 'content-length' && pair[0] !== 'content-type')
          c.set(pair[0], pair[1])

      c.body = fileRes.data

      c.set('Content-Type', mime.getType(fileExt) || 'application/octet-stream')

      setHeader(c, false)

      if (['HEAD', 'GET'].includes(c.method))
        c.set('Cache-Control', 'public, max-age=1800')
    },
  )
}
