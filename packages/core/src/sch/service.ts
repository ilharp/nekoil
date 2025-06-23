import type { Context, User } from 'koishi'
import { Service } from 'koishi'
import type { BaseBot as OneBotBaseBot } from 'koishi-plugin-nekoil-adapter-onebot'
import type { Config } from '../config'

declare module 'koishi' {
  interface Context {
    nekoilSch: NekoilSchService
  }
}

export class NekoilSchService extends Service {
  static inject = ['database', 'nekoilCpMsg']

  #l

  constructor(ctx: Context, nekoilConfig: Config) {
    super(ctx, 'nekoilSch')

    this.#l = ctx.logger('nekoilSch')

    ctx.on('message', async (session) => {
      try {
        if (session.isDirect) return
        if (session.platform !== 'onebot') return
        if (!nekoilConfig.sch.listen.includes(Number(session.channelId))) return

        const elements = session.event.message!.elements!

        if (elements.length !== 1) return
        if (elements[0]!.type !== 'forward') return
        if (!elements[0]!.attrs['id']) return

        const resid = elements[0]!.attrs['id']! as string

        const bot = session.bot as OneBotBaseBot

        await session.observeUser(['id'])

        const forwardMsg = (await bot.internal.getForwardMsg(resid)).message

        const parsedContent = await ctx.nekoilCpMsg.parseOneBot(forwardMsg, bot)

        const {} = await ctx.nekoilCp.cpCreate(parsedContent, {
          cpPlatform: 3,
          idType: 'resid',
          resid,
          user: session.user! as unknown as User,
        })
      } catch (e) {}
    })
  }
}
