import type { Bot, Context } from 'koishi'
import { Random } from 'koishi'

export const name = 'nekoil-bind'

export const inject = ['database']

interface TokenData {
  /** 原始平台 ID */
  id: string
  bot: Bot
}

export function apply(ctx: Context) {
  const tokens = Object.create(null) as Record<string, TokenData>

  const prefix = 'nekoil/'
  const generateToken = () => prefix + Random.id(6, 10)

  const bind = async (aid: number, platform: string, pid: string) => {
    await ctx.database.set('binding', { platform, pid }, { aid })
  }

  ctx
    .platform('telegram')
    .private()
    .command('bind', { authority: 0 })
    .userFields(['id'])
    .option('remove', '-r')
    .action(async ({ session, options }) => {
      if (options!.remove) {
        const platform = session!.platform
        const pid = session!.userId!

        const bindings = await ctx.database.get('binding', {
          aid: session!.user!.id,
        })

        const binding = bindings.find(
          (item) => item.platform === platform && item.pid === pid,
        )!

        if (binding.aid !== binding.bid) {
          // restore the original binding
          await bind(binding.bid, platform, pid)

          return '账号解绑成功！'
        } else if (
          bindings.filter((item) => item.aid === item.bid).length === 1
        ) {
          return '无法解除绑定：这是你的原始账号。你可能需要前往另外一个账号解除绑定。'
        } else {
          // create a new account
          const authority = await session!.resolve(
            ctx.root.config.autoAuthorize as number,
          )

          const user = await ctx.database.create('user', { authority })

          await bind(user.id, platform, pid)

          return '账号解绑成功！'
        }
      }

      const token = generateToken()

      tokens[token] = {
        id: session!.userId!,
        bot: session!.bot as unknown as Bot,
      }

      ctx.setTimeout(() => delete tokens[token], 5 * 60 * 1000)

      return `Bind 指令可将其他账号绑定到本账号。绑定后，你可以在其他账号上创建聊天记录，并在本账号上获得结果。
绑定过程中，本账号的数据将完全保留，而目标平台的数据将被本账号的数据所覆盖。
要开始绑定，请在 5 分钟内在目标平台发送以下 Token 给 Nekoil：
${token}
绑定完成后，你可以随时使用「bind -r」来解除绑定状态。`
    })

  ctx.middleware(async (session, next) => {
    const token = session.stripped.content
    const data = tokens[token]

    if (!data) return next()

    const { id: originalUserId, bot: originalBot } = data

    if (session.platform === 'telegram' && originalUserId === session.userId) {
      return '要绑定其他账号到本账号，Token 要使用目标平台的账号发送给 Nekoil，而不是本账号。发送后，目标平台的账号数据会被覆盖。'
    }

    delete tokens[token]

    const [binding] = await ctx.database.get(
      'binding',
      {
        platform: 'telegram',
        pid: originalUserId,
      },
      ['aid'],
    )

    await bind(binding!.aid, session.platform, session.userId!)

    await originalBot.sendPrivateMessage(originalUserId, '账号绑定成功！')
  }, true)
}
