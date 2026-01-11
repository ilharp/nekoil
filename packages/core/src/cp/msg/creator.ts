import type { Bot, Context } from 'koishi'
import type TelegramBot from 'koishi-plugin-nekoil-adapter-telegram'
// import type { NekoilMsgQueue } from './service'

export const name = 'nekoil-cp-msg-creator'

export const inject = ['nekoilCp', 'nekoilCpMsg']

export const apply = async (ctx: Context) => {
  const l = ctx.logger('nekoilCpMsgCreator')

  ctx
    .platform('telegram')
    .private()
    .command('nekoilcpnew')
    .action(async ({ session }) => {
      const channel = `${session!.platform}:${session!.channelId}`

      const message = await (
        session!.bot as unknown as TelegramBot
      ).internal.sendMessage({
        chat_id: Number(session!.channelId),
        text: '新聊天记录',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ 允许长图预览',
                callback_data: 'CCL',
              },
            ],
            [
              {
                text: '创建',
                callback_data: 'CN',
              },
            ],
          ],
        },
        // @ts-expect-error
        link_preview_options: {
          is_disabled: true,
        },
      })

      ctx.nekoilCpMsg.initSlow(
        channel,
        session!.bot as unknown as Bot,
        session!.channelId!,
        message.message_id!,
      )
    })

  ctx.on('telegram/callback-query', async (input, bot) => {
    const cmd = input.data! as (typeof callbackQueryCmd)[number]
    if (!callbackQueryCmd.includes(cmd)) return

    const user_id = input.from!.id

    const channel = `telegram:${user_id}`

    // const configMessageId = ctx.nekoilCpMsg.getConfigMessageId(channel)

    try {
      switch (cmd) {
        case 'CN': {
          // 这里暂定，不管用户点了哪个按钮，不管处于哪个模式，都一律 flush
          // 后续要改进的话，在 NekoilMsgQueue 里加个 /new 时随机生成的 uuid，在这里判断下
          ctx.nekoilCpMsg.emit('flush', channel)

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          bot.internal.answerCallbackQuery({
            callback_query_id: input.id,
            text: '正在创建聊天记录……',
          })

          return
        }

        case 'CCL': {
          const newState = ctx.nekoilCpMsg.toggleLargePreview(channel)

          // 更新按钮文字
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          bot.internal.editMessageReplyMarkup({
            chat_id: user_id,
            message_id: input.message!.message_id!,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: newState ? '✅ 允许长图预览' : '❌ 允许长图预览',
                    callback_data: 'CCL',
                  },
                ],
                [
                  {
                    text: '创建',
                    callback_data: 'CN',
                  },
                ],
              ],
            },
          })

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          bot.internal.answerCallbackQuery({
            callback_query_id: input.id,
            text: newState ? '已开启长图预览' : '已关闭长图预览',
          })

          return
        }

        case 'CM': {
          return
        }

        case 'CT': {
          return
        }
      }
    } catch (e) {
      l.error(
        `cp: error processing cb query ${cmd}, id ${input.id}, message ${input.message!.message_id}`,
      )
      l.error(e)
    }
  })
}

// const msg = (state: NekoilMsgQueue, cmd: (typeof callbackQueryCmd)[number]) => {
//   let inline_keyboard

//   switch (cmd) {
//     case 'CM': {
//       inline_keyboard = [
//         [
//           {
//             text: '创建',
//             callback_data: 'CN',
//           },
//         ],
//       ]

//       break
//     }

//     case 'CT': {
//       break
//     }
//   }

//   return {
//     text: '新聊天记录',
//     parse_mode: 'HTML',
//     reply_markup: {
//       inline_keyboard,
//     },
//     // @ts-expect-error
//     link_preview_options: {
//       is_disabled: true,
//     },
//   }
// }

const callbackQueryCmd = [
  // 创建
  'CN',
  // 切换长图预览
  'CCL',
  // 去主菜单
  'CM',
  // 去排版菜单
  'CT',
] as const
