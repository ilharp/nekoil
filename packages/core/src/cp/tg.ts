import type {} from '@koishijs/plugin-adapter-telegram'
import type { Context } from 'koishi'

export const name = 'nekoil-cp-tg'

export const inject = ['nekoilCp']

export const apply = (ctx: Context) => {
  ctx.on('telegram/inline-query', async (query, bot) => {
    // const user = await ctx.database.createUser(
    //   'telegram',
    //   String(query.from!.id!),
    //   {},
    // )

    const cp = await ctx.nekoilCp.cpGet()

    await bot.internal.answerInlineQuery({
      inline_query_id: query.id!,
      is_personal: true,
      cache_time: 300,
      results: [
        {
          type: 'article',
          id: 'help',
          title: cp.data!.title,
          description: cp.data!.summary.length
            ? cp.data!.summary[0]
            : `查看 ${cp.data!.messages.length} 条聊天记录`,
          input_message_content: {
            message_text: `<b>${cp.data!.title}</b>\n\n${cp.data!.summary}`,
            parse_mode: 'HTML',
          },
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `查看 ${cp.data!.messages.length} 条聊天记录`,
                  url: 'https://t.me/nekoilbot?startapp=help',
                },
              ],
            ],
          },
        },
      ],
    })
  })
}
