/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */

import type TelegramBot from '@koishijs/plugin-adapter-telegram'
import type { Event, Message } from '@satorijs/protocol'
import type { Bot, Context, User } from 'koishi'
import { h, Service } from 'koishi'
import type {} from 'koishi-plugin-redis'
import { WatchError } from 'koishi-plugin-redis'
import { debounce, escape } from 'lodash-es'
import type {
  ContentPackHandleV1,
  ContentPackV1,
  ContentPackWithAll,
} from 'nekoil-typedef'
import { generateHandle } from '../utils'
import { summaryMessagerSend } from './summary'

interface Emitter {
  fn: () => unknown
  lock: number
}

declare module 'koishi' {
  interface Context {
    nekoilMsg: NekoilMsgService
  }
}

export interface NekoilMsgSession {
  isDirect: boolean
  event: Event
}

export class NekoilMsgService extends Service {
  static inject = ['redis', 'database']

  #l

  constructor(ctx: Context) {
    super(ctx, 'nekoilMsg')

    this.#l = ctx.logger('nekoilMsg')
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      await this.ctx.redis.client.executeIsolated(async (client) => {
        const lmtKey = `nekoilv1:msg:${channel}:time`
        const dataKey = `nekoilv1:msg:${channel}:data`

        await client.watch(dataKey)

        let multi = client.multi()
        multi.get(lmtKey)
        const [lmt] = (await multi.exec()) as [string]
        if (new Date().getTime() - Number(lmt) < 3500)
          return this.#buildFn(channel, emitter)

        multi = client.multi()
        multi.lRange(dataKey, 0, -1)
        multi.del(dataKey)
        multi.del(lmtKey)

        const [sessions] = (await multi.exec()) as [string[], number, number]

        const splitIndex = channel.indexOf(':')
        const platform = channel.slice(0, splitIndex)
        const channelId = channel.slice(splitIndex + 1)

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.#process(
          platform,
          channelId,
          sessions.map((x) => JSON.parse(x) as NekoilMsgSession),
        )
      })
    } catch (e) {
      if (e instanceof WatchError) {
        return this.#buildFn(channel, emitter)
      } else {
        this.#l.error(`error processing channel ${channel}`)
        this.#l.error(e)
      }
    }
  }

  #process = (
    platform: string,
    channelId: string,
    sessions: NekoilMsgSession[],
  ) => {
    switch (platform) {
      case 'telegram': {
        return this.#processTelegram(channelId, sessions)
      }

      default: {
        this.#l.error(`unknown platform ${platform}?`)
        return
      }
    }
  }

  #processTelegram = async (
    _channelId: string,
    sessions: NekoilMsgSession[],
  ) => {
    // FIXME
    const bot = this.ctx.bots[0] as unknown as TelegramBot

    const len = sessions.length
    sessions.sort(
      (a, b) =>
        a.event._data.message.message_id - b.event._data.message.message_id,
    )

    const lastSession = sessions[len - 1]

    try {
      let contentType: 'forward' | 'satori' | 'onebot' = 'forward'
      let content: string | undefined = undefined
      let satoriContent: h[] | undefined = undefined
      let parsedSatoriContent: h | undefined = undefined
      let oneBotContent: any | undefined = undefined
      let parsedOneBotContent:
        | {
            type: 'node'
            data: any
          }[]
        | undefined = undefined

      // 判断是否均为纯文本
      if (
        sessions.every(
          (x) =>
            x.event.message!.elements!.length === 1 &&
            x.event.message!.elements![0]?.type === 'text',
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

      const pid = lastSession!.event.user!.id
      const pidNumber = Number(pid)

      const { message_id: progressMsg } = await bot.internal.sendMessage({
        chat_id: pidNumber,
        text: loadingContent,
        parse_mode: 'MarkdownV2',
      })

      const onProgress = async (text: string) => {
        await bot.internal.editMessageText({
          chat_id: pidNumber,
          message_id: progressMsg!,
          text: `${loadingContent}\n${text}`,
          parse_mode: 'MarkdownV2',
        })
      }

      let parsedContent: h[]
      switch (contentType) {
        case 'satori':
          parsedContent = parsedSatoriContent!.children.filter(
            (x) => x.type === 'message',
          )
          break
        case 'onebot':
          parsedContent = await this.#parseOneBot(parsedOneBotContent!)
          break
        case 'forward':
          parsedContent = await this.#parseTelegramForward(sessions)
          break
      }

      const { cpAll, cpHandle } = await this.#createContentPack(parsedContent, {
        cpPlatform: contentType === 'forward' ? 2 : 1,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        bot,
        platform: 'telegram',
        pid,
        loadingContent,
        onProgress,
      })

      await bot.internal.sendMessage({
        chat_id: pidNumber,
        text: `<b>${escape(cpAll.summary.title)}</b>\n\n${cpAll.summary.summary.map(escape).join('\n')}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `查看 ${cpAll.summary.count} 条聊天记录`,
                url: `https://t.me/nekoilbot?startapp=%2B${cpHandle.handle}`,
              },
              {
                text: '转发',
                switch_inline_query: `+${cpHandle.handle}`,
              },
            ],
          ],
        },
      })

      await bot.internal.deleteMessage({
        chat_id: pidNumber,
        message_id: progressMsg!,
      })
    } catch (e) {
      this.#l.error(`error processing tg message: ${e}`)

      await bot.sendPrivateMessage(
        lastSession!.event.user!.id,
        `出现了错误：\n${e}`,
      )
    }
  }

  #parseOneBot = async (
    _content: {
      type: 'node'
      data: any
    }[],
  ): Promise<h[]> => {
    return []
  }

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

  /**
   * @param content `<message>` 构成的数组。
   */
  #createContentPack = async (
    content: h[],
    option: CreateOption,
    intlState?: CreateState,
  ): Promise<CreateResult> => {
    const state: CreateState = intlState ?? {
      createdCount: 0,
    }

    state.createdCount++

    if (state.createdCount > 32) throw new Error('套娃层数超过限制。')

    if (state.createdCount > 1)
      option.onProgress(`正在创建 ${state.createdCount} 组记录。`)

    state.user ??= await this.ctx.database.getUser(option.platform, option.pid)

    const pack: Partial<ContentPackWithAll> = {
      created_time: new Date(),
      deleted: 0,
      deleted_reason: 0,

      cp_version: 1,
      data_full_mode: 2,
      platform: option.cpPlatform,

      creator: state.user.id,
      owner: state.user.id,
    }

    const messages = await Promise.all(
      content.map(async (elem) => {
        const author = elem.children.find((x) => x.type === 'author')
        const elements = elem.children.filter((x) => x !== author)

        const forwardIndex = elements.findIndex(
          (x) => x.type === 'message' && x.attrs['forward'],
        )
        if (forwardIndex > -1) {
          const forward = elements[forwardIndex]!
          const { cpHandle } = await this.#createContentPack(
            forward.children.filter((x) => x.type === 'message'),
            option,
            state,
          )
          elements.splice(
            forwardIndex,
            1,
            <nekoil:cp handle={`+${cpHandle.handle}`} />,
          )
        }

        const protocolMessage: Message = {
          content: elements.join(''),
          user: {
            id: author?.attrs['id'],
            name: author?.attrs['name'],
            avatar: author?.attrs['avatar'],
          },
        }

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const summary = `${author?.attrs['name'] || '用户'}${(
          await summaryMessagerSend(elements)
        )
          .join('')
          .replace(/\r/g, '')
          .replace(/\n/g, ' ')}`

        return {
          message: protocolMessage,
          summary,
        }
      }),
    )

    pack.full = {
      messages: messages.map((x) => x.message),
    }

    pack.summary = {
      count: messages.length,
      title: '群聊的聊天记录',
      summary: messages.map((x) => x.summary),
    }

    const cpCreate = {
      ...pack,
      summary: undefined,
      full: undefined,
      data_summary: JSON.stringify(pack.summary),
      data_full: JSON.stringify(pack.full),
    } as ContentPackV1

    const cp = await this.ctx.database.create('cp_v1', cpCreate)

    let cpHandle: ContentPackHandleV1
    while (true) {
      try {
        cpHandle = await this.ctx.database.create('cp_handle_v1', {
          created_time: new Date(),
          deleted: 0,
          deleted_reason: 0,

          cpid: cp.cpid,
          handle_type: 1,
          handle: generateHandle(16, true),
        })

        break
      } catch (_) {
        // continue
      }
    }

    return {
      cpAll: pack as ContentPackWithAll,
      cp,
      cpHandle,
    }
  }
}

interface CreateOption {
  cpPlatform: 1 | 2 | 3
  bot: Bot
  platform: string
  pid: string
  loadingContent: string
  onProgress: (text: string) => unknown
}

interface CreateState {
  createdCount: number
  user?: User
}

interface CreateResult {
  cpAll: ContentPackWithAll
  cp: ContentPackV1
  cpHandle: ContentPackHandleV1
}
