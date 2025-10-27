import type { Bot, Context, h, User } from 'koishi'

export const name = 'nekoil-cp-msg-middleware'

export const inject = ['nekoilCpMsg']

export const apply = async (ctx: Context) => {
  // const l = ctx.logger('nekoilCpMsg')

  ctx.private().middleware((session, next) =>
    next(async () => {
      const channel = `${session.platform}:${session.channelId}`

      const mode = ctx.nekoilCpMsg.getMode(channel)

      ctx.nekoilCpMsg.push(
        mode,
        channel,
        session.bot as unknown as Bot,
        session.channelId!,
        {
          isDirect: session.isDirect,
          event: {
            ...session.event,
            message: {
              ...session.event.message,
              elements: undefined as unknown as h[],
            },
          },
          user: session.user! as unknown as User,
        },
      )

      if (mode === 'fast') ctx.nekoilCpMsg.emit('fast', channel)
    }),
  )
}
