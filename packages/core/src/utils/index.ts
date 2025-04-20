import type { ParameterizedContext } from 'koa'

export const setHeader = (c: ParameterizedContext) => {
  c.set({
    Connection: 'keep-alive',
    'Cache-Control': 'no-store',
    'X-Powered-By': 'Nekoil master-0',
  })
}

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

const generateHandle = (length: number, human: boolean) => {
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
