import type { Context } from 'koishi'
import { h } from 'koishi'
import type { NekoilUser } from '../../services/user'

export const name = 'nekoil-cp-imgr-commands'

export const inject = ['nekoilCpImgr', 'nekoilCp']

export const apply = async (ctx: Context) => {
  // @ts-ignore
  const l = ctx.logger('nekoilCpImgrCommands')

  ctx
    .platform('telegram')
    .command('nekoilimgrtest <handle:string>')
    .action(async ({ session }, handle) => {
      const cp = await ctx.nekoilCp.cpGet(
        undefined as unknown as NekoilUser,
        handle,
        true,
      )

      if (cp.code !== 200)
        return (
          <>
            <quote id={session!.messageId} />
            {h('code-block', { lang: 'json' }, JSON.stringify(cp))}
          </>
        )

      const images = await ctx.nekoilCpImgr.render(cp.data!)

      return (
        <>
          <quote id={session!.messageId} />
          {images.map((x) => h.image(x, 'image/png'))}
        </>
      )
    })
}
