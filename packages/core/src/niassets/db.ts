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

  ctx.model.extend('niassets_v1', {
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
      type: 'string',
      length: 1,
      nullable: false,
    },

    mime: {
      type: 'string',
      length: 1,
      nullable: false,
    },
  })

  ctx.model.extend('niassets_rc_v1', {
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
  })
}
