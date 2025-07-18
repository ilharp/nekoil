import type { ParameterizedContext } from 'koa'
import type { ContentPackHandleV1 } from 'nekoil-typedef'
import { promisify } from 'node:util'
import { zstdCompress, zstdDecompress } from 'node:zlib'

export const setHeader = (c: ParameterizedContext, noCache = true) => {
  if (
    /^https:\/\/beta\.390721\.xyz/.exec(c.headers.referer!) ||
    /^https:\/\/390721\.xyz/.exec(c.headers.referer!) ||
    /^https?:\/\/localhost:/.exec(c.headers.referer!)
  )
    c.set({
      'Access-Control-Allow-Origin': new URL(c.headers.referer!).origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Nekoil-Init-Data, Content-Type',
      'Access-Control-Max-Age': '86400',
    })

  c.set({
    Connection: 'keep-alive',
    'X-Powered-By': 'Nekoil master-0',
  })

  if (noCache) c.set('Cache-Control', 'no-store')
}

export const databaseBaseCreate = {
  created_time: new Date(),
  deleted: 0,
  deleted_reason: 0,
} as const

export const databaseBaseFields = {
  created_time: {
    type: 'timestamp',
    nullable: false,
  },

  deleted: {
    type: 'unsigned',
    length: 1,
    nullable: false,
  },

  deleted_time: {
    type: 'timestamp',
    nullable: true,
  },

  deleted_reason: {
    type: 'unsigned',
    length: 1,
    nullable: false,
  },
} as const

export const databaseBaseQuery = {
  deleted: false,
} as const

export const generateHandle = (length: number, human: boolean) => {
  const handle = human ? handleH : handleM
  const handleLength = human ? handleHLength : handleMLength
  let n = ''
  for (let i = 0; i < length; i++)
    n += handle.charAt(Math.floor(Math.random() * handleLength))
  return n
}

const handleH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const handleHLength = handleH.length
const handleM = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const handleMLength = handleM.length

export const getHandle = (
  cpHandle: Pick<ContentPackHandleV1, 'handle' | 'handle_type'>,
) => {
  if ([1, 4].includes(cpHandle.handle_type)) return `_${cpHandle.handle}`
  return cpHandle.handle
}

export class NoLoggingError extends Error {}
export class UserSafeError extends Error {}

export const ellipsis = (text: string, max: number) => {
  const len = text.length
  let i = 0
  let l = 0
  while (l < len) {
    const c = text.charCodeAt(i)

    if ((c >= 0x0001 && c <= 0x007e) || (c >= 0xff60 && c <= 0xff9f)) l += 1
    else l += 2

    if (l >= max) return `${text.slice(0, i)}...`

    i++
  }

  return text
}

export const zstdCompressAsync = promisify(zstdCompress)
export const zstdDecompressAsync = promisify(zstdDecompress)

export const regexResid = /^[0-9a-zA-Z/+]{64}$/g

export const authorId2Char = (id: number) => String.fromCodePoint(0x4e00 + id)

export interface ReplyParameters {
  message_id: number
  allow_sending_without_reply?: boolean
}
