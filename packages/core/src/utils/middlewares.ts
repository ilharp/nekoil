import type { Middleware } from '@koa/router'
import type { Config } from '../config'

export const middlewareProxyToken = (config: Config) =>
  ((c, next) => {
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

    return next()
  }) satisfies Middleware

export const middlewareCfCountry = () =>
  ((c, next) => {
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

    return next()
  }) satisfies Middleware

export const isValidInternalToken = (
  config: Config,
  nekoilInternalToken: string | string[] | undefined,
) =>
  typeof nekoilInternalToken === 'string' &&
  nekoilInternalToken.length > 0 &&
  nekoilInternalToken === config.internalToken

export const middlewareInternalToken = (config: Config) =>
  ((c, next) => {
    if (
      !isValidInternalToken(config, c.request.header['nekoil-internal-token'])
    ) {
      c.body = {
        code: 2007,
        msg: 'EXXXXX FORBIDDEN',
      }
      return
    }

    return next()
  }) satisfies Middleware
