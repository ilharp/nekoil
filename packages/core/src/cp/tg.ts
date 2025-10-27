import type { Context } from 'koishi'
import type {
  InlineQueryResult,
  TelegramBot,
} from 'koishi-plugin-nekoil-adapter-telegram'
import { escape } from 'lodash-es'
import type { Config } from '../config'
import type { NekoilUser } from '../services/user'
import { UserSafeError } from '../utils'

export const name = 'nekoil-cp-tg'

export const inject = ['nekoilCp', 'nekoilCpMsg', 'nekoilCpImgr', 'database']

export const apply = (ctx: Context, config: Config) => {
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

    const results: InlineQueryResult[] = [
      {
        type: 'article',
        id: 'txt',
        title: '以文本形式发送',
        input_message_content: {
          message_text: `<a href="${ctx.nekoilCp.getTgStartAppUrl(cp.data!.handle)}"><b>${escape(cp.data!.cp.summary.title)}</b></a>\n\n${cp.data!.cp.summary.summary.map(escape).join('\n')}`,
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
    ]

    let tgFileId: string | undefined

    if (cp.data!.cp.cpssr_niaid) {
      const [nia] = await ctx.database.get(
        'niassets_v1',
        cp.data!.cp.cpssr_niaid,
        ['tg_file_id'],
      )

      if (nia!.tg_file_id) tgFileId = nia!.tg_file_id
    }

    if (tgFileId) {
      results.unshift({
        type: 'photo',
        id: 'img',
        title: cp.data!.cp.summary.title,
        description: cp.data!.cp.summary.summary.join('\n'),
        photo_file_id: tgFileId,
        // @ts-expect-error
        show_caption_above_media: true,
        caption: `<a href="${ctx.nekoilCp.getTgStartAppUrl(cp.data!.handle)}"><b>${escape(cp.data!.cp.summary.title)}</b></a>`,
        parse_mode: 'HTML',
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
      })
    } else {
      results.unshift({
        type: 'article',
        id: 'img',
        title: cp.data!.cp.summary.title,
        description: cp.data!.cp.summary.summary.join('\n'),
        input_message_content: {
          message_text: `生成图片时出现错误。点击复制 <code>/showimg ${cp.data!.handle}</code> 发送给 @${config.tgBotName} 以重新生成图片。文本模式仍然可用。`,
          parse_mode: 'HTML',
        },
      })
    }

    await bot.internal.answerInlineQuery({
      inline_query_id: query.id!,

      // TODO: type4 上线前改为 true
      is_personal: false,

      cache_time: noCache ? 0 : 300,
      results,
    })
  })

  ctx.on('telegram/callback-query', async (input, bot) => {
    try {
      const data = input.data
      if (data !== 'CN') return

      const user_id = input.from!.id

      const channel = `telegram:${user_id}`

      // 这里暂定，不管用户点了哪个按钮，不管处于哪个模式，都一律 flush
      // 后续要改进的话，在 NekoilMsgQueue 里加个 /new 时随机生成的 uuid，在这里判断下
      ctx.nekoilCpMsg.emit('flush', channel)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      bot.internal.answerCallbackQuery({
        callback_query_id: input.id,
        text: '正在创建聊天记录……',
      })
    } catch (e) {
      l.error(
        `cp: error processing cb query ${input.id}, message ${input.message!.message_id}`,
      )
      l.error(e)
    }
  })
}
