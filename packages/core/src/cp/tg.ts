import type {} from 'koishi-plugin-nekoil-adapter-telegram'
import type { Context } from 'koishi'
import type { NekoilUser } from '../services/user'
import { escape } from 'lodash-es'

export const name = 'nekoil-cp-tg'

export const inject = ['nekoilCp']

export const apply = (ctx: Context) => {
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

    let cp = await ctx.nekoilCp.cpGet(
      undefined as unknown as NekoilUser,
      queryHandle,
      false,
    )

    if (cp.code !== 200) {
      noCache = true

      if (cp.code === 404)
        cp = await ctx.nekoilCp.cpGet(
          undefined as unknown as NekoilUser,
          'notfound',
          false,
        )
      else
        cp = await ctx.nekoilCp.cpGet(
          undefined as unknown as NekoilUser,
          'error',
          false,
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
          title: cp.data!.summary.title,
          description: cp.data!.summary.summary.join('\n'),
          input_message_content: {
            message_text: `<b>${escape(cp.data!.summary.title)}</b>\n\n${cp.data!.summary.summary.map(escape).join('\n')}`,
            parse_mode: 'HTML',
          },
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `查看 ${cp.data!.summary.count} 条聊天记录`,
                  url: ctx.nekoilCp.getTgStartAppUrl(queryHandle),
                },
                {
                  text: '转发',
                  switch_inline_query: queryHandle,
                },
              ],
            ],
          },
        },
      ],
    })
  })
}
