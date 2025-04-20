import type { QueryFunctionContext } from '@tanstack/react-query'
import type { NekoilResponseBody } from 'nekoil-typedef'

export const requestV1 =
  <TData>(api: string, init: RequestInit = {}) =>
  async ({ signal }: QueryFunctionContext) => {
    const response = await fetch(`https://api.390721.xyz${api}`, {
      method: 'POST',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...(init.headers ?? {}),
      },
      signal,
    })

    if (!response.ok) {
      throw new NekoilApiError(response.status, await response.text())
    }

    const body = (await response.json()) as NekoilResponseBody<TData>
    if (body.code !== 200) throw new NekoilApiError(body.code, body.msg)
    return body.data!
  }

export class NekoilApiError extends Error {
  constructor(
    public code: number,
    msg?: string,
  ) {
    super(msg)
  }
}
