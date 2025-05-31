import type { Context, h, User } from 'koishi'
import type {} from 'koishi-plugin-redis'
import type { NekoilMsgSession } from './service'

export const name = 'nekoil-cp-msg-middleware'

export const inject = ['redis', 'nekoilCpMsg']

export const apply = async (ctx: Context) => {
  // const l = ctx.logger('nekoilCpMsg')

  ctx.private().middleware((session, next) =>
    next(async () => {
      const channel = `${session.platform}:${session.channelId}`
      const lmtKey = `nekoilv1:msg:${channel}:time`
      const dataKey = `nekoilv1:msg:${channel}:data`

      ctx.nekoilCpMsg.lock(channel)

      await ctx.redis.client.set(lmtKey, new Date().getTime())
      await ctx.redis.client.lPush(
        dataKey,
        JSON.stringify({
          isDirect: session.isDirect,
          event: {
            ...session.event,
            message: {
              ...session.event.message,
              elements: undefined as unknown as h[],
            },
          },
          user: session.user! as unknown as User,
        } satisfies NekoilMsgSession),
      )

      ctx.nekoilCpMsg.unlock(channel)
      ctx.nekoilCpMsg.emit(channel)
    }),
  )
}
