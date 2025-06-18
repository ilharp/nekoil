import type { Context } from 'koishi'

export const name = 'nekoil-cp-msg-commands'

export const inject = ['nekoilCpMsg']

export const apply = async (ctx: Context) => {
  ctx
    .platform('telegram')
    .command('nekoilpack [...rest]')
    .action(async ({}, ..._rest) => {})
}
