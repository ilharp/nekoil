import type { Context } from 'koishi'
import type {} from 'koishi-plugin-redis'
import type { NekoilMsgSession } from './service'

export const name = 'nekoil-msg-middleware'

export const inject = ['redis', 'nekoilMsg']

export const apply = async (ctx: Context) => {
  // const l = ctx.logger('nekoilMsg')

  ctx.private().middleware((session, next) =>
    next(async () => {
      const channel = `${session.platform}:${session.channelId}`
      const lmtKey = `nekoilv1:msg:${channel}:time`
      const dataKey = `nekoilv1:msg:${channel}:data`

      ctx.nekoilMsg.lock(channel)

      await ctx.redis.client.set(lmtKey, new Date().getTime())
      await ctx.redis.client.lPush(
        dataKey,
        JSON.stringify({
          isDirect: session.isDirect,
          event: session.event,
        } satisfies NekoilMsgSession),
      )

      ctx.nekoilMsg.unlock(channel)
      ctx.nekoilMsg.emit(channel)
    }),
  )
}
