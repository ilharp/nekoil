import type { Context } from 'koishi'

export const name = 'nekoil-assets-tg'

export const inject = ['nekoilAssets']

export const apply = (ctx: Context) => {
  const l = ctx.logger('nekoilAssetsTg')

  ctx
    .platform('telegram')
    .private()
    .command('nekoilassetcleanup', '清理无引用的资源', {
      permissions: ['nekoil:9'],
    })
    .action(async () => {
      try {
        const result = await ctx.nekoilAssets.cleanup()

        const failedText = result.failed.length
          ? `：${result.failed.join(', ')}`
          : ''

        return `资源清理完成：扫描 ${result.scanned}，删除 ${result.removed}，失败 ${result.failed.length}${failedText}`
      } catch (e) {
        l.error('nekoilassetcleanup failed')
        l.error(e)

        return '资源清理失败，请查看服务端日志。'
      }
    })
}
