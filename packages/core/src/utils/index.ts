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

const generateHandle = () => {
  let n = ''
  for (let i = 0; i < 16; i++)
    n += handleDict.charAt(Math.floor(Math.random() * handleDictLength))
  return n
}

const handleDict = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const handleDictLength = handleDict.length
