import type { ParameterizedContext } from 'koa'

export const setHeader = (c: ParameterizedContext) => {
  if (
    /^https:\/\/390721\.xyz/.exec(c.headers.referer!) ||
    /^https?:\/\/localhost:/.exec(c.headers.referer!)
  )
    c.set({
      'Access-Control-Allow-Origin': new URL(c.headers.referer!).origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })

  c.set({
    Connection: 'keep-alive',
    'Cache-Control': 'no-store',
    'X-Powered-By': 'Nekoil master-0',
  })
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

export class NoLoggingError extends Error {}
