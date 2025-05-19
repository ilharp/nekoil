/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import type {} from '@koishijs/plugin-server'
import { createProxyServer } from 'http-proxy'
import type { Context } from 'koishi'
import type { Config } from '../config'
import { setHeader, zstdDecompressAsync } from '../utils'
import mime from 'mime'

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
    async (c) => {
      if (c.method === 'OPTIONS') {
        c.status = 200
        setHeader(c)
        c.set('Allow', 'GET,HEAD,OPTIONS')
        c.flushHeaders()
        c.body = Buffer.allocUnsafe(0)
        return
      }

      const nekoilProxyToken = c.request.header['nekoil-proxy-token']
      if (
        !nekoilProxyToken ||
        Array.isArray(nekoilProxyToken) ||
        !nekoilProxyToken.length ||
        nekoilProxyToken !== config.proxyToken
      ) {
        c.status = 403
        setHeader(c)
        c.flushHeaders()
        c.body = Buffer.allocUnsafe(0)
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
        setHeader(c)
        c.flushHeaders()
        c.body = Buffer.allocUnsafe(0)
        return
      }

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

      const fileRes = await ctx.http(
        `${config.assets.endpoint}/v1/${filename}`,
        {
          responseType: 'arraybuffer',
        },
      )

      for (const pair of fileRes.headers.entries())
        if (pair[0] !== 'content-length' && pair[0] !== 'content-type')
          c.set(pair[0], pair[1])

      const fileRaw = await zstdDecompressAsync(fileRes.data)
      c.body = fileRaw

      c.set('Content-Type', mime.getType(fileExt) || 'application/octet-stream')

      setHeader(c, false)

      if (['HEAD', 'GET'].includes(c.method))
        c.set('Cache-Control', 'public, max-age=60') // 1800
    },
  )
}
