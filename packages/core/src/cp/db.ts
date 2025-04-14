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

  /**
   * 1=zstdv1
   */
  content_mode: number

  content: string

  user_id: number

  /**
   * 1=manual 2=tg 3=qq
   */
  platform: number

  cp_version: number
}

export interface ContentPackHandleV1 extends DatabaseBase {
  cpid: number

  /**
   * 1=private 2=public
   */
  handle_type: number

  handle: string
}

export const apply = (ctx: Context) => {
  ctx.model.extend('cp_v1', {
    ...databaseBaseFields,
  })

  ctx.model.extend('cp_handle_v1', {
    ...databaseBaseFields,

    cpid: {
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
  })
}
