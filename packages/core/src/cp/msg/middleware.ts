import type { Context, h, User } from 'koishi'

export const name = 'nekoil-cp-msg-middleware'

export const inject = ['nekoilCpMsg']

export const apply = async (ctx: Context) => {
  // const l = ctx.logger('nekoilCpMsg')

  ctx.private().middleware((session, next) =>
    next(async () => {
      const channel = `${session.platform}:${session.channelId}`

      ctx.nekoilCpMsg.push(channel, {
        isDirect: session.isDirect,
        event: {
          ...session.event,
          message: {
            ...session.event.message,
            elements: undefined as unknown as h[],
          },
        },
        user: session.user! as unknown as User,
      })

      ctx.nekoilCpMsg.emit(channel)
    }),
  )
}
