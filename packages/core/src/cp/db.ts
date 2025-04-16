import type { Context } from 'koishi'
import type { ContentPackHandleV1, ContentPackV1 } from 'nekoil-typedef'
import { databaseBaseFields } from '../utils'

export const name = 'nekoil-cp-db'

declare module 'koishi' {
  interface Tables {
    cp_v1: ContentPackV1
    cp_handle_v1: ContentPackHandleV1
  }
}

export const apply = (ctx: Context) => {
  ctx.model.extend(
    'cp_v1',
    {
      ...databaseBaseFields,

      cpid: {
        type: 'unsigned',
        length: 64,
        nullable: false,
      },

      cp_version: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },
    },
    {
      primary: 'cpid',
      autoInc: true,
    },
  )

  ctx.model.extend(
    'cp_handle_v1',
    {
      ...databaseBaseFields,

      handle_id: {
        type: 'unsigned',
        length: 64,
        nullable: false,
      },

      handle_type: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      handle: {
        type: 'char',
        length: 64,
        nullable: false,
      },

      cpid: {
        type: 'unsigned',
        length: 64,
        nullable: false,
      },
    },
    {
      primary: 'handle_id',
      autoInc: true,
      unique: ['handle'],
    },
  )
}
