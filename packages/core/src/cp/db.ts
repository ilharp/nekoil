import type { Context } from 'koishi'
import type {
  ContentPackFull,
  ContentPackHandleV1,
  ContentPackSummary,
  ContentPackV1,
} from 'nekoil-typedef'
import { databaseBaseCreate, databaseBaseFields } from '../utils'

export const name = 'nekoil-cp-db'

export const inject = ['database']

declare module 'koishi' {
  interface Tables {
    cp_v1: ContentPackV1
    cp_handle_v1: ContentPackHandleV1
  }
}

export const apply = async (ctx: Context) => {
  const l = ctx.logger('nekoilCpDb')

  ctx.model.extend(
    'cp_v1',
    {
      ...databaseBaseFields,

      cpid: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      cp_version: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      creator: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      owner: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },

      data_full_mode: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      data_full: {
        type: 'text',
        length: 1,
        nullable: false,
      },

      data_summary: {
        type: 'text',
        length: 1,
        nullable: false,
      },

      platform: {
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
        length: 8,
        nullable: false,
      },

      handle_type: {
        type: 'unsigned',
        length: 1,
        nullable: false,
      },

      handle: {
        type: 'string',
        length: 64,
        nullable: false,
      },

      cpid: {
        type: 'unsigned',
        length: 8,
        nullable: false,
      },
    },
    {
      primary: 'handle_id',
      autoInc: true,
      unique: ['handle'],
    },
  )

  const builtin = await ctx.database.get(
    'cp_handle_v1',
    {
      handle_type: 2,
      handle: 'help',
    },
    ['handle_id'],
  )

  if (!builtin.length) {
    l.info('Inserting builtin cps.')

    const helpCp = await ctx.database.create('cp_v1', helpCpCreate)
    const notFoundCp = await ctx.database.create('cp_v1', notFoundCpCreate)
    const errorCp = await ctx.database.create('cp_v1', errorCpCreate)

    await ctx.database.upsert('cp_handle_v1', [
      { ...cpHandleBaseCreate, handle: 'help', cpid: helpCp.cpid },
      { ...cpHandleBaseCreate, handle: 'notfound', cpid: notFoundCp.cpid },
      { ...cpHandleBaseCreate, handle: 'error', cpid: errorCp.cpid },
    ])

    l.success('Successfully inserted builtin cps.')
  }
}

const cpBaseCreate = {
  ...databaseBaseCreate,
  cp_version: 1,
  creator: 0,
  owner: 0,
  data_full_mode: 2,
  platform: 1,
} as const

const cpHandleBaseCreate = {
  ...databaseBaseCreate,
  handle_type: 2,
} as const

const helpCpFull: ContentPackFull = {
  messages: [
    {
      content: '我是 Nekoil，一个多功能的 bot。',
      // @ts-expect-error We don't need user.id here
      user: {
        name: 'Nekoil',
      },
    },
  ],
} as const

const helpCpSummary: ContentPackSummary = {
  count: 1,
  title: 'Nekoil 帮助',
  summary: ['查看 Nekoil 的帮助'],
} as const

const notFoundCpFull: ContentPackFull = {
  messages: [
    {
      content:
        '找不到对应的聊天记录，请检查链接或 ID 是否正确。要从 resid 创建聊天记录，请先将 resid 私发给 nekoil。',
      // @ts-expect-error We don't need user.id here
      user: {
        name: 'Nekoil',
      },
    },
  ],
} as const

const notFoundCpSummary: ContentPackSummary = {
  count: 1,
  title: '¯\\_(ツ)_/¯',
  summary: ['找不到对应的聊天记录，请检查链接或 ID 是否正确。'],
} as const

const errorCpFull: ContentPackFull = {
  messages: [
    {
      content: '出现问题，请稍后再试。',
      // @ts-expect-error We don't need user.id here
      user: {
        name: 'Nekoil',
      },
    },
  ],
} as const

const errorCpSummary: ContentPackSummary = {
  count: 1,
  title: '¯\\_(ツ)_/¯',
  summary: ['出现问题，请稍后再试。'],
} as const

const helpCpCreate = {
  ...cpBaseCreate,
  data_full: JSON.stringify(helpCpFull),
  data_summary: JSON.stringify(helpCpSummary),
} as const

const notFoundCpCreate = {
  ...cpBaseCreate,
  data_full: JSON.stringify(notFoundCpFull),
  data_summary: JSON.stringify(notFoundCpSummary),
} as const

const errorCpCreate = {
  ...cpBaseCreate,
  data_full: JSON.stringify(errorCpFull),
  data_summary: JSON.stringify(errorCpSummary),
} as const
