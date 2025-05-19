import type { Context } from 'koishi'
import type { NiAssetsRcV1, NiAssetsV1 } from 'nekoil-typedef'

export const name = 'nekoil-assets-db'

declare module 'koishi' {
  interface Tables {
    niassets_v1: NiAssetsV1
    niassets_rc_v1: NiAssetsRcV1
  }
}

export const apply = (ctx: Context) => {
  // const l = ctx.logger('nekoilAssetsDb')

  ctx.model.extend(
    'niassets_v1',
    {
      niaid: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      type: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      handle: {
        type: 'string',
        length: 44,
        nullable: false,
      },

      size: {
        type: 'unsigned',
        length: 4, // 4 byte = 32bit = 4G
        nullable: false,
      },

      filename: {
        type: 'text',
        length: 512, // 260
        nullable: false,
      },

      mime: {
        type: 'string',
        length: 128, // 73
        nullable: false,
      },

      thumbhash: {
        type: 'string',
        length: 1024, // 64
      },

      width: {
        type: 'unsigned',
        length: 4,
        nullable: false,
      },

      height: {
        type: 'unsigned',
        length: 4,
        nullable: false,
      },
    },
    {
      primary: 'niaid',
      autoInc: true,
      unique: ['handle'],
    },
  )

  ctx.model.extend(
    'niassets_rc_v1',
    {
      id: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      niaid: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      ref_type: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      ref: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },
    },
    {
      primary: 'id',
      autoInc: true,
      unique: [['niaid', 'ref_type', 'ref']],
    },
  )
}
