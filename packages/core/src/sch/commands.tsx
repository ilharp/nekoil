import type { Context } from 'koishi'

export const name = 'nekoil-sch-commands'

export const inject = ['nekoilCp', 'database']

export const apply = (ctx: Context) => {
  ctx
    .platform('telegram')
    .private()
    .command('nekoilschpost [handle:string]')
    .action(async () => {
      //
    })
}
