import type { Context } from 'koishi'
import type { Config } from '../config'

export const name = 'nekoil-sch-tg'

export const inject = ['database', 'nekoilSch']

export const apply = (ctx: Context, _config: Config) => {
  const l = ctx.logger('nekoilSchTg')

  ctx.on('telegram/callback-query', async (input, bot) => {
    let approve

    try {
      let data = input.data
      if (!data) return
      if (!data.startsWith('S')) return
      data = data.slice(1)

      // if (!config.sch.admins.includes(input.from!.id!)) {
      //   // eslint-disable-next-line @typescript-eslint/no-floating-promises
      //   bot.internal.answerCallbackQuery({
      //     callback_query_id: input.id,
      //     text: '你谁？',
      //   })

      //   return
      // }

      approve = data.startsWith('A')
      data = data.slice(1)

      const schid = Number(data)

      if (approve) {
        await ctx.database.set('sch_v1', schid, {
          state: 2,
        })
        await ctx.nekoilSch.send(schid)
      } else {
        await ctx.database.set('sch_v1', schid, {
          state: 3,
        })
      }
    } catch (e) {
      l.error(
        `sch: error processing cb query ${input.id}, message ${input.message!.message_id}`,
      )
      l.error(e)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      bot.internal.answerCallbackQuery({
        callback_query_id: input.id,
        text: `报错了：${e}`,
      })
    }

    try {
      await bot.internal.deleteMessage({
        chat_id: input.message!.chat!.id,
        message_id: input.message!.message_id,
      })
    } catch (_e) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      bot.internal.answerCallbackQuery({
        callback_query_id: input.id,
        text: '删除消息失败，请手动删除此条消息',
      })
    }
  })
}
