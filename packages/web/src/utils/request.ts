import type { QueryFunctionContext } from '@tanstack/react-query'
import type { NekoilResponseBody } from 'nekoil-typedef'

const baseUrl = {
  beta: 'https://beta-api.390721.xyz',
  production: 'https://api.390721.xyz',
}[__DEFINE_NEKOIL_ENV__]

export const requestV1 =
  <TData>(api: string, init: RequestInit = {}) =>
  async ({ signal }: QueryFunctionContext) => {
    const response = await Promise.race([
      fetch(`${baseUrl}${api}`, {
        method: 'POST',
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'Nekoil-Init-Data': window.Telegram.WebApp.initData,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...(init.headers ?? {}),
        },
        signal,
      }),
      new Promise<Response>((_, rej) =>
        setTimeout(() => {
          rej(new NekoilApiError(2000, '超时'))
        }, 12000),
      ),
    ])

    if (!response.ok) {
      throw new NekoilApiError(response.status, await response.text())
    }

    const body = (await response.json()) as NekoilResponseBody<TData>
    if (body.code !== 200) throw new NekoilApiError(body.code, body.msg)
    return body.data!
  }

export const requestBlobV1 =
  (api: string, init: RequestInit = {}) =>
  async ({ signal }: QueryFunctionContext) => {
    const response = await Promise.race([
      fetch(`${baseUrl}${api}`, {
        ...init,
        headers: {
          'Nekoil-Init-Data': window.Telegram.WebApp.initData,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...(init.headers ?? {}),
        },
        signal,
      }),
      new Promise<Response>((_, rej) =>
        setTimeout(() => {
          rej(new NekoilApiError(2000, '超时'))
        }, 12000),
      ),
    ])

    if (!response.ok) {
      throw new NekoilApiError(response.status, await response.text())
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

export class NekoilApiError extends Error {
  constructor(
    public code: number,
    msg?: string,
  ) {
    super(msg)
  }
}
