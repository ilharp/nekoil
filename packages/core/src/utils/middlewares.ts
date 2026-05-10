import type { Middleware } from '@koa/router'
import type { Span } from '@opentelemetry/api'
import { trace } from '@opentelemetry/api'
import type { Config } from '../config'

declare module 'koa' {
  interface BaseContext {
    span: Span
  }
}

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

export const middlewareOTel = (routeName: string) =>
  (async (c, next) => {
    const tracer = trace.getTracer('nekoil-core', '0.1.0')

    const span = tracer.startSpan(routeName)

    c.span = span

    try {
      await next()
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      span.recordException(e as any)
      throw e
    } finally {
      span.end()
    }
  }) satisfies Middleware
