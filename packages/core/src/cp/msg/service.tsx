/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */

import type { Event } from '@satorijs/protocol'
import type { Context, User } from 'koishi'
import { h, Service } from 'koishi'
import type {
  CQCode,
  BaseBot as OneBotBaseBot,
} from 'koishi-plugin-nekoil-adapter-onebot'
import { OneBot } from 'koishi-plugin-nekoil-adapter-onebot'
import type TelegramBot from 'koishi-plugin-nekoil-adapter-telegram'
import type {} from 'koishi-plugin-redis'
import { WatchError } from 'koishi-plugin-redis'
import { debounce, escape } from 'lodash-es'
import { getHandle, regexResid } from '../../utils'
import type { CpCreateOptionId } from '../service'

interface Emitter {
  fn: () => unknown
  lock: number
}

declare module 'koishi' {
  interface Context {
    nekoilCpMsg: NekoilCpMsgService
  }
}

export interface NekoilMsgSession {
  isDirect: boolean
  event: Event
  user: User
}

type OneBotForwardMsg = {
  type: 'node'
  data: {
    user_id: string
    nickname: string
    content: CQCode[]
  }
}[]

export class NekoilCpMsgService extends Service {
  static inject = ['nekoilCp', 'redis', 'database']

  #l

  constructor(ctx: Context) {
    super(ctx, 'nekoilCpMsg')

    this.#l = ctx.logger('nekoilCpMsg')
  }

  #emitMap: Record<string, Emitter> = {}

  #getEmitter = (channel: string) => {
    if (!this.#emitMap[channel]) {
      const emitter = {
        lock: 0,
      } as Emitter
      emitter.fn = debounce(this.#buildFn(channel, emitter), 3500)
      this.#emitMap[channel] = emitter
    }
    return this.#emitMap[channel]
  }

  emit = (channel: string) => {
    this.#getEmitter(channel).fn()
  }

  lock = (channel: string) => {
    this.#getEmitter(channel).lock++
  }

  unlock = (channel: string) => {
    this.#getEmitter(channel).lock--
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  #buildFn = (channel: string, emitter: Emitter) => async () => {
    if (emitter.lock) return

    try {
      const client = await this.ctx.redis.isolate()

      const lmtKey = `nekoilv1:msg:${channel}:time`
      const dataKey = `nekoilv1:msg:${channel}:data`

      await client.watch(dataKey)

      let multi = client.multi()
      multi.get(lmtKey)
      const [lmt] = (await multi.exec()) as unknown as [string]
      if (new Date().getTime() - Number(lmt) < 3500)
        return this.#buildFn(channel, emitter)

      multi = client.multi()
      multi.lRange(dataKey, 0, -1)
      multi.del(dataKey)
      multi.del(lmtKey)

      const [sessions] = (await multi.exec()) as unknown as [
        string[],
        number,
        number,
      ]

      if (sessions.length) {
        const splitIndex = channel.indexOf(':')
        const platform = channel.slice(0, splitIndex)
        // const channelId = channel.slice(splitIndex + 1)

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.#process(
          platform,
          sessions.map((x) => JSON.parse(x) as NekoilMsgSession),
        )
      }
    } catch (e) {
      if (e instanceof WatchError) {
        return this.#buildFn(channel, emitter)
      } else {
        this.#l.error(`error processing channel ${channel}`)
        this.#l.error(e)
        // setTimeout(() => {
        //   this.#buildFn(channel, emitter)
        // }, 5000)
      }
    }
  }

  #process = async (platform: string, sessions: NekoilMsgSession[]) => {
    let progressMsg: number | undefined = undefined

    const len = sessions.length
    sessions.sort(
      (a, b) =>
        a.event._data.message.message_id - b.event._data.message.message_id,
    )

    const lastSession = sessions[len - 1]!
    const pid = lastSession.event.user!.id
    const pidNumber = Number(pid)

    const bot = this.ctx.bots[`${platform}:${lastSession.event.selfId}`]!
    const obBot = this.ctx.bots.find(
      (x) => x.platform === 'onebot',
    )! as OneBotBaseBot
    // const tgBot = this.ctx.bots.find(
    //   (x) => x.platform === 'telegram',
    // )! as TelegramBot

    try {
      let contentType: 'forward' | 'satori' | 'onebot' | 'obForward' = 'forward'
      let resid: string | undefined = undefined
      let oneBotForwardMsg: OneBotForwardMsg | undefined = undefined
      let content: string | undefined = undefined
      let satoriContent: h[] | undefined = undefined
      let parsedSatoriContent: h | undefined = undefined
      let oneBotContent: any | undefined = undefined
      let parsedOneBotContent:
        | {
            type: 'node'
            data: {
              user_id: string
              nickname: string
              content: CQCode[]
            }
          }[]
        | undefined = undefined

      // 解析到 elements
      sessions.forEach((x) => {
        x.event.message!.elements = h.parse(x.event.message!.content!)
      })

      // 判断是否为 obForward
      if (
        /* contentType === 'forward' && */ platform === 'onebot' &&
        len === 1
      ) {
        const elements = lastSession.event.message!.elements!
        if (
          elements.length === 1 &&
          elements[0]!.type === 'forward' &&
          elements[0]!.attrs['id']
        ) {
          contentType = 'obForward'
          resid = elements[0]!.attrs['id']!
        }
      }

      // 判断是否为 resid
      if (contentType === 'forward' && len === 1) {
        const session = sessions[0]!
        if (
          session.event.message!.elements!.length === 1 &&
          session.event.message!.elements![0]!.type === 'text'
        ) {
          const content = (
            session.event.message!.elements![0]!.attrs['content'] as string
          ).trim()
          if (regexResid.test(content)) {
            try {
              oneBotForwardMsg ??= (await obBot.internal.getForwardMsg(content))
                .message
              contentType = 'obForward'
              resid = content
            } catch (cause) {
              throw new Error('获取聊天记录内容失败，可能已经过期', {
                cause,
              })
            }
          }
        }
      }

      // 判断是否均为纯文本
      if (
        contentType === 'forward' &&
        sessions.every(
          (x) =>
            x.event.message!.elements!.length === 1 &&
            x.event.message!.elements![0]!.type === 'text',
        )
      ) {
        // 都是纯文本，拼接起来
        content = sessions
          .map((x) => x.event.message!.elements![0]!.attrs['content'])
          .join('')
          .trim()

        // 检查是否为 Satori Element - Message Forward
        satoriContent = h.parse(content)
        if (
          satoriContent.some((x) => x.type === 'message' && x.attrs['forward'])
        ) {
          // 是 Message Forward
          contentType = 'satori'
          parsedSatoriContent = satoriContent.find(
            (x) => x.type === 'message' && x.attrs['forward'],
          )
        } else {
          // 检查是否为 OneBot
          try {
            oneBotContent = JSON.parse(content)

            if (
              Array.isArray(oneBotContent.data?.message) &&
              oneBotContent.data.message[0]?.type === 'node'
            ) {
              // 是最外层
              contentType = 'onebot'
              parsedOneBotContent = oneBotContent.data?.message
            } else if (Array.isArray(oneBotContent)) {
              // 是数组层
              contentType = 'onebot'
              parsedOneBotContent = oneBotContent
            }
          } catch (_) {
            // 并不是 OneBot
          }
        }
      }

      let loadingContent: string
      switch (contentType) {
        case 'obForward':
          loadingContent = '正在解析聊天记录…………'
          break
        case 'satori':
          loadingContent = '正在从 Satori 创建聊天记录…………'
          break
        case 'onebot':
          loadingContent = '正在从 OneBot 创建聊天记录…………'
          break
        case 'forward':
          loadingContent = `正在使用 ${len} 条消息创建聊天记录…………`
          break
      }

      switch (platform) {
        case 'telegram': {
          const tgBot = bot as unknown as TelegramBot
          progressMsg = (
            await tgBot.internal.sendMessage({
              chat_id: pidNumber,
              text: loadingContent,
            })
          ).message_id!
          break
        }

        default: {
          this.#l.info(
            `Creating cp, type ${contentType} platform ${platform} pid ${pidNumber}`,
          )
          break
        }
      }

      const onProgress = async (text: string) => {
        if (platform === 'telegram') {
          const tgBot = bot as unknown as TelegramBot
          await tgBot.internal.editMessageText({
            chat_id: pidNumber,
            message_id: progressMsg!,
            text: `${loadingContent}\n${text}`,
          })
        }
      }

      /**
       * 消息元素的数组，其中每个消息元素的类型都为 message，children 中首个元素为 author
       */
      let parsedContent: h[]
      let cpCreateOptionId: CpCreateOptionId

      switch (contentType) {
        case 'obForward': {
          oneBotForwardMsg ??= (
            await (bot as OneBotBaseBot).internal.getForwardMsg(resid!)
          ).message

          parsedContent = await this.#parseOneBot(
            oneBotForwardMsg,
            bot as OneBotBaseBot,
          )
          cpCreateOptionId = {
            idType: 'resid',
            resid: resid!,
          }
          break
        }
        case 'satori':
          parsedContent = parsedSatoriContent!.children.filter(
            (x) => x.type === 'message',
          )
          cpCreateOptionId = {
            idType: 'unlisted',
          }
          break
        case 'onebot':
          parsedContent = await this.#parseOneBot(parsedOneBotContent!)
          cpCreateOptionId = {
            idType: 'unlisted',
          }
          break
        case 'forward':
          switch (platform) {
            case 'onebot': {
              parsedContent = await this.#parseOneBotForward(sessions)
              break
            }
            case 'telegram': {
              parsedContent = await this.#parseTelegramForward(sessions)
              break
            }
            default:
              throw new Error()
          }
          cpCreateOptionId = {
            idType: 'unlisted',
          }
          break
      }

      const { cpAll, cpHandle } = await this.ctx.nekoilCp.cpCreate(
        parsedContent,
        {
          cpPlatform: contentType === 'forward' ? 2 : 1,
          platform: 'telegram',
          pid,
          onProgress,
          ...cpCreateOptionId,
          user: lastSession.user,
        },
      )

      switch (platform) {
        case 'telegram': {
          const tgBot = bot as unknown as TelegramBot
          await tgBot.internal.sendMessage({
            chat_id: pidNumber,
            text: `<b>${escape(cpAll.summary.title)}</b>\n\n${cpAll.summary.summary.map(escape).join('\n')}`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `查看 ${cpAll.summary.count} 条聊天记录`,
                    url: `https://t.me/nekoilbot?startapp=${getHandle(cpHandle)}`,
                  },
                  {
                    text: '转发',
                    switch_inline_query: getHandle(cpHandle),
                  },
                ],
              ],
            },
          })
          break
        }

        default: {
          this.#l.info(
            `cp ${getHandle(cpHandle)} created, platform ${platform} pid ${pidNumber}`,
          )
          break
        }
      }

      if (progressMsg) {
        await bot.deleteMessage(
          platform === 'onebot' ? `private:${pidNumber}` : String(pidNumber),
          String(progressMsg),
        )
      }
    } catch (e) {
      this.#l.error(`error processing message:`)
      this.#l.error(e)

      switch (platform) {
        case 'telegram': {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          bot.sendPrivateMessage(String(pidNumber), `出现了错误：\n${e}`)
          break
        }

        default:
          break
      }

      switch (platform) {
        case 'telegram': {
          const tgBot = bot as unknown as TelegramBot
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          tgBot.internal.sendMessage({
            chat_id: pidNumber,
            text: `出现了错误：\n${e}`,
          })
          break
        }

        default:
          break
      }

      if (progressMsg) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        bot.deleteMessage(
          platform === 'onebot' ? `private:${pidNumber}` : String(pidNumber),
          String(progressMsg),
        )
      }
    }
  }

  #parseOneBot = async (
    content: OneBotForwardMsg,
    bot?: OneBotBaseBot,
  ): Promise<h[]> => {
    return this.#parseOneBotIntl(content, bot, 0)
  }

  /**
   * @param createdCount 使用值类型避免误伤单层嵌套里包含多条 cp 的情况
   *
   * @returns 消息元素的数组，其中每个消息元素的类型都为 message，children 中首个元素为 author
   */
  #parseOneBotIntl = async (
    content: OneBotForwardMsg,
    bot: OneBotBaseBot | undefined,
    createdCount: number,
  ): Promise<h[]> => {
    createdCount++

    if (createdCount > 32) throw new Error('套娃层数超过限制。')

    return Promise.all(
      content.map(async (node) => {
        const children = await OneBot.adaptElements(node.data.content, bot)

        const message: h = (
          <message>
            <author
              id={String(node.data.user_id)}
              name={node.data.nickname}
              avatar={`http://thirdqq.qlogo.cn/headimg_dl?dst_uin=${node.data.user_id}&spec=640`}
            />
            {children}
          </message>
        )

        return message
      }),
    )
  }

  /**
   * @returns 消息元素的数组，其中每个消息元素的类型都为 message，children 中首个元素为 author
   */
  #parseOneBotForward = async (_sessions: NekoilMsgSession[]): Promise<h[]> => {
    return []
  }

  /**
   * @returns 消息元素的数组，其中每个消息元素的类型都为 message，children 中首个元素为 author
   */
  #parseTelegramForward = async (
    sessions: NekoilMsgSession[],
  ): Promise<h[]> => {
    const result = sessions.map((session) => {
      let author = h('author', {
        id: session.event.user!.id,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        name: session.event.user!.nick || session.event.user!.name,
        avatar: session.event.user!.avatar,
      })

      const forward = session.event._data?.message?.forward_origin

      if (forward) {
        // 避免正在创建 cp 的用户隐私泄漏
        author = h('author')

        switch (forward.type) {
          case 'user':
            author.attrs['id'] = forward.sender_user.id
            author.attrs['name'] =
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              `${forward.sender_user.first_name || ''} ${forward.sender_user.last_name || ''}`
            break

          case 'hidden_user':
            author.attrs['name'] = forward.sender_user_name
            break

          case 'channel':
          case 'chat':
            author.attrs['name'] =
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              forward.chat.title || forward.author_signature
            break
        }
      }

      const message: h = (
        <message>
          {author}
          {session.event.message!.elements}
        </message>
      )

      return message
    })

    return result
  }
}
