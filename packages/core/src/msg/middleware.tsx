import type { Context } from 'koishi'
import type {} from 'koishi-plugin-redis'

export const name = 'nekoil-msg-middleware'

export const inject = ['redis', 'nekoilMsg']

export const apply = async (ctx: Context) => {
  ctx.middleware((session, next) =>
    next(async () => {
      const channel = `${session.platform}:${session.channelId}`
      const key = `nekoilv1:msg:${channel}`

      ctx.nekoilMsg.lock(channel)

      await ctx.redis.client.lPush(key, JSON.stringify(session.event))

      ctx.nekoilMsg.unlock(channel)
      ctx.nekoilMsg.emit(channel)
    }),
  )
}
