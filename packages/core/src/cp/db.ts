import type { Context } from 'koishi'

export const name = 'nekoil-cp-db'

declare module 'koishi' {
  interface Tables {
    cp_v1: ContentPackV1
    cp_handle_v1: ContentPackHandleV1
  }
}

export interface DatabaseBase {
  created_time: Date

  deleted: number

  deleted_time: Date

  /**
   * 1=admin 2=user
   */
  deleted_reason: number
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

export interface ContentPackV1 extends DatabaseBase {
  cpid: number

  cp_version: number

  creator: number

  owner: number

  /**
   * 1=zstdv1 2=jsonv1
   */
  data_full_mode: number

  data_full: string

  data_summary: string

  user_id: number

  /**
   * 1=manual 2=tg 3=qq
   */
  platform: number
}

export interface ContentPackHandleV1 extends DatabaseBase {
  handle_id: number

  /**
   * 1=unlisted(+) 2=public 3=resid 4=private(+)
   */
  handle_type: number

  handle: string

  cpid: number
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
      unique: [['handle_type', 'handle']],
    },
  )
}
