import type { Context } from 'koishi'

export const name = 'nekoil-msg-middleware'

export const inject = ['database', 'nekoilMsg']

export const apply = async (ctx: Context) => {
  ctx.middleware((session, next) =>
    next(async () => {
      const channel = `${session.platform}${session.channelId}`

      ctx.nekoilMsg.lock(channel)

      await ctx.database.create('nekoil_msg_v1', {})

      ctx.nekoilMsg.unlock(channel)
      ctx.nekoilMsg.emit(channel)
    }),
  )
}
