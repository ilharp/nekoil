import type { Context } from 'koishi'

export const name = 'nekoil-sch-db'

declare module 'koishi' {
  interface Tables {
    sch_v1: NekoilSchV1
  }
}

export interface NekoilSchV1 {
  schid: number
  handle_id: number
  // last_access_time: Date

  /**
   * 1=queue 2=approved 3=rejected 4=posted
   */
  state: number

  message_id: number
}

export const apply = (ctx: Context) => {
  ctx.model.extend(
    'sch_v1',
    {
      schid: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      handle_id: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      // last_access_time: {
      //   type: 'timestamp',
      //   nullable: false,
      // },

      state: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      message_id: {
        type: 'unsigned',
        length: 8,
        nullable: true,
      },
    },
    {
      primary: 'schid',
      autoInc: true,
    },
  )
}
