import type { Bot, Context } from 'koishi'
import type TelegramBot from 'koishi-plugin-nekoil-adapter-telegram'

export const name = 'nekoil-cp-msg-commands'

export const inject = ['nekoilCpMsg']

export const apply = async (ctx: Context) => {
  // ctx
  //   .platform('telegram')
  //   .command('nekoilpack [...rest]')
  //   .action(async ({}, ..._rest) => {})

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
}
