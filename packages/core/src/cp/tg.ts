import type { Context } from 'koishi'
import type { TelegramBot } from 'koishi-plugin-nekoil-adapter-telegram'
import { escape } from 'lodash-es'
import type { NekoilUser } from '../services/user'
import { UserSafeError } from '../utils'

export const name = 'nekoil-cp-tg'

export const inject = ['nekoilCp', 'nekoilCpImgr']

export const apply = (ctx: Context) => {
  const l = ctx.logger('nekoilCpTg')

  ctx
    .platform('telegram')
    .private()
    .command('nekoilcpshow <handle:string>')
    // @ts-expect-error
    .action(async ({ session }, handle) => {
      const cp = await ctx.nekoilCp.cpGetWithHandle(
        undefined as unknown as NekoilUser,
        handle,
        true,
        true,
      )

      if (cp.code !== 200)
        return '找不到对应的聊天记录，请检查链接或 ID 是否正确。要从 resid 创建聊天记录，请先将 resid 私发给 nekoil。'

      try {
        await ctx.nekoilCpImgr.sendCpssr({
          chatId: Number(session!.channelId),
          cpwf: cp.data!.cp,
          handle: cp.data!.handle,
          bot: session!.bot as unknown as TelegramBot,
          replyParameters: {
            message_id: Number(session!.messageId),
            allow_sending_without_reply: true,
          },
        })
      } catch (e) {
        l.error(
          `nekoilcpshow: error sending message '${cp.data!.handle}' as img, try sending text.`,
        )
        l.error(e)

        await session!.send(
          `获取聊天记录截图时出现错误，将尝试以文本形式发送${e instanceof UserSafeError ? `：${e.message}` : '。'}`,
        )

        await ctx.nekoilCp.sendCptxt({
          chatId: Number(session!.channelId),
          cpwf: cp.data!.cp,
          handle: cp.data!.handle,
          bot: session!.bot as unknown as TelegramBot,
          replyParameters: {
            message_id: Number(session!.messageId),
            allow_sending_without_reply: true,
          },
        })
      }
    })

  ctx
    .platform('telegram')
    .private()
    .command('nekoilcpshowimg <handle:string>')
    // @ts-expect-error
    .action(async ({ session }, handle) => {
      const cp = await ctx.nekoilCp.cpGetWithHandle(
        undefined as unknown as NekoilUser,
        handle,
        true,
        true,
      )

      if (cp.code !== 200)
        return '找不到对应的聊天记录，请检查链接或 ID 是否正确。要从 resid 创建聊天记录，请先将 resid 私发给 nekoil。'

      await ctx.nekoilCpImgr.sendCpssr({
        chatId: Number(session!.channelId),
        cpwf: cp.data!.cp,
        handle: cp.data!.handle,
        bot: session!.bot as unknown as TelegramBot,
        replyParameters: {
          message_id: Number(session!.messageId),
          allow_sending_without_reply: true,
        },
      })
    })

  ctx
    .platform('telegram')
    .private()
    .command('nekoilcpshowtext <handle:string>')
    // @ts-expect-error
    .action(async ({ session }, handle) => {
      const cp = await ctx.nekoilCp.cpGetWithHandle(
        undefined as unknown as NekoilUser,
        handle,
        true,
        true,
      )

      if (cp.code !== 200)
        return '找不到对应的聊天记录，请检查链接或 ID 是否正确。要从 resid 创建聊天记录，请先将 resid 私发给 nekoil。'

      await ctx.nekoilCp.sendCptxt({
        chatId: Number(session!.channelId),
        cpwf: cp.data!.cp,
        handle: cp.data!.handle,
        bot: session!.bot as unknown as TelegramBot,
        replyParameters: {
          message_id: Number(session!.messageId),
          allow_sending_without_reply: true,
        },
      })
    })

  ctx.on('telegram/inline-query', async (query, bot) => {
    // const user = await ctx.nekoilUser.getUser(
    //   'telegram',
    //   String(query.from!.id!),
    //   {
    //     name: query.from!.username,
    //   },
    // )

    let noCache = false
    let queryHandle = query.query?.trim()

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    queryHandle ||= 'help'

    let cp = await ctx.nekoilCp.cpGetWithHandle(
      undefined as unknown as NekoilUser,
      queryHandle,
      false,
      true,
    )

    if (cp.code !== 200) {
      noCache = true

      if (cp.code === 404)
        cp = await ctx.nekoilCp.cpGetWithHandle(
          undefined as unknown as NekoilUser,
          'notfound',
          false,
        )
      else
        cp = await ctx.nekoilCp.cpGetWithHandle(
          undefined as unknown as NekoilUser,
          'error',
          false,
          true,
        )
    }

    await bot.internal.answerInlineQuery({
      inline_query_id: query.id!,

      // TODO: type4 上线前改为 true
      is_personal: false,

      cache_time: noCache ? 0 : 300,
      results: [
        {
          type: 'article',
          id: 'help',
          title: cp.data!.cp.summary.title,
          description: cp.data!.cp.summary.summary.join('\n'),
          input_message_content: {
            message_text: `<b>${escape(cp.data!.cp.summary.title)}</b>\n\n${cp.data!.cp.summary.summary.map(escape).join('\n')}`,
            parse_mode: 'HTML',
          },
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `查看 ${cp.data!.cp.summary.count} 条聊天记录`,
                  url: ctx.nekoilCp.getTgStartAppUrl(cp.data!.handle),
                },
                {
                  text: '转发',
                  switch_inline_query: cp.data!.handle,
                },
              ],
            ],
          },
        },
      ],
    })
  })
}
