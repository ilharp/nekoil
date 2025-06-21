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
import { debounce } from 'lodash-es'
import { getHandle, regexResid, UserSafeError } from '../../utils'
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
  static inject = ['nekoilCp', 'database', 'nekoilCpImgr', 'nekoilAssets']

  #l

  constructor(ctx: Context) {
    super(ctx, 'nekoilCpMsg')

    this.#l = ctx.logger('nekoilCpMsg')
  }

  #msgMap: Record<
    string,
    {
      lmt: number
      sessions: NekoilMsgSession[]
    }
  > = {}

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

  push = (channel: string, session: NekoilMsgSession) => {
    if (!this.#msgMap[channel]) {
      this.#msgMap[channel] = {
        lmt: new Date().getTime(),
        sessions: [session],
      }
      return
    }

    this.#msgMap[channel].lmt = new Date().getTime()
    this.#msgMap[channel].sessions.push(session)
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

  #buildFn = (channel: string, emitter: Emitter) => async () => {
    if (emitter.lock) return

    try {
      const msgSessions = this.#msgMap[channel]

      if (!msgSessions) return

      if (new Date().getTime() - Number(msgSessions.lmt) < 3500) {
        setTimeout(() => {
          this.#buildFn(channel, emitter)
        }, 1000)
        return
      }

      delete this.#msgMap[channel]

      if (msgSessions.sessions.length) {
        const splitIndex = channel.indexOf(':')
        const platform = channel.slice(0, splitIndex)
        // const channelId = channel.slice(splitIndex + 1)

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.#process(platform, msgSessions.sessions)
      }
    } catch (e) {
      this.#l.error(`error processing channel ${channel}`)
      this.#l.error(e)
      // setTimeout(() => {
      //   this.#buildFn(channel, emitter)
      // }, 5000)
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
    const tgBot = this.ctx.bots.find(
      (x) => x.platform === 'telegram',
    )! as unknown as TelegramBot

    const notifBot = tgBot
    const notifUserId = (
      await this.ctx.database.get('binding', {
        aid: lastSession.user.id,
        platform: 'telegram',
      })
    )[0]?.pid

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
              throw new UserSafeError('获取聊天记录内容失败，可能已经过期。', {
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

      if (notifUserId) {
        progressMsg = (
          await notifBot.internal.sendMessage({
            chat_id: notifUserId,
            text: loadingContent,
          })
        ).message_id!
      } else {
        this.#l.info(
          `Creating cp, type ${contentType} platform ${platform} pid ${pidNumber}`,
        )
      }

      const onProgress = async (text: string) => {
        if (progressMsg)
          await notifBot.internal.editMessageText({
            chat_id: pidNumber,
            message_id: progressMsg,
            text: `${loadingContent}\n${text}`,
          })
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
          // 从 OneBot 的 json 文本创建消息记录，
          // 此时 bot 可能是任意平台
          // 因此我们传我们的 obBot 进去，只用来解析内层的合并转发
          parsedContent = await this.#parseOneBot(parsedOneBotContent!, obBot)
          cpCreateOptionId = {
            idType: 'unlisted',
          }
          break
        case 'forward':
          switch (platform) {
            case 'onebot': {
              // 此时 platform 已经是 onebot，可以直接传 bot 进去
              parsedContent = await this.#parseOneBotForward(
                sessions,
                bot as OneBotBaseBot,
              )
              break
            }
            case 'telegram': {
              parsedContent = await this.#parseTelegramForward(
                sessions,
                bot as unknown as TelegramBot,
              )
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

      let cpPlatform: 1 | 2 | 3

      switch (contentType) {
        case 'forward':
          switch (platform) {
            case 'telegram':
              cpPlatform = 2
              break
            case 'onebot':
              cpPlatform = 3
              break
            default:
              cpPlatform = 1
              break
          }
          break
        case 'satori':
          cpPlatform = 1
          break
        case 'onebot':
          cpPlatform = 3
          break
        case 'obForward':
          cpPlatform = 3
          break
      }

      const { cpwf, cpHandle } = await this.ctx.nekoilCp.cpCreate(
        parsedContent,
        {
          cpPlatform,
          pid,
          onProgress,
          ...cpCreateOptionId,
          user: lastSession.user,
        },
      )

      const handle = getHandle(cpHandle)

      if (progressMsg) {
        await notifBot.internal.editMessageText({
          chat_id: pidNumber,
          message_id: progressMsg,
          text: `已生成 ${cpwf.summary.count} 条聊天记录。正在生成图片…`,
        })
      }

      try {
        await this.ctx.nekoilCpImgr.sendCpssr({
          chatId: notifUserId,
          bot: notifBot,
          cpwf,
          handle,
        })
      } catch (e) {
        this.#l.error(`cpssr err in cp create for cpid ${cpwf.cpid}`)
        this.#l.error(e)

        if (progressMsg) {
          await notifBot.internal.editMessageText({
            chat_id: pidNumber,
            message_id: progressMsg,
            text: `图片生成失败。`,
          })

          await this.ctx.nekoilCp.sendCptxt({
            chatId: notifUserId,
            bot: notifBot,
            cpwf,
            handle,
          })

          // progressMsg 留给用户，不用删了
          progressMsg = undefined
        }
      }

      this.#l.info(
        `cp ${handle} created, platform ${platform} pid ${pidNumber}`,
      )

      if (progressMsg) {
        await notifBot.deleteMessage(notifUserId!, String(progressMsg))
        progressMsg = undefined
      }
    } catch (e) {
      this.#l.error(`error processing message:`)
      this.#l.error(e)

      if (notifUserId) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        notifBot.internal.sendMessage({
          chat_id: notifUserId,
          text: `生成聊天记录时出现错误${e instanceof UserSafeError ? `：${e.message}` : '。'}`,
        })
      }

      if (progressMsg) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        notifBot.deleteMessage(notifUserId!, String(progressMsg))
        progressMsg = undefined
      }
    }
  }

  #parseOneBot = async (
    content: OneBotForwardMsg,
    bot: OneBotBaseBot,
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
    bot: OneBotBaseBot,
    createdCount: number,
  ): Promise<h[]> => {
    createdCount++

    if (createdCount > 32) throw new UserSafeError('套娃层数超过限制。')

    return Promise.all(
      content.map(async (node) => {
        const children = await OneBot.adaptElements(node.data.content, bot)

        const elements = await this.#processOneBotMessages(
          children,
          bot,
          createdCount,
        )

        const message: h = (
          <message>
            <author
              id={String(node.data.user_id)}
              name={node.data.nickname}
              avatar={`http://thirdqq.qlogo.cn/headimg_dl?dst_uin=${node.data.user_id}&spec=640`}
            />
            {elements}
          </message>
        )

        return message
      }),
    )
  }

  /**
   * @returns 消息元素的数组，其中每个消息元素的类型都为 message，children 中首个元素为 author
   */
  #parseOneBotForward = async (
    sessions: NekoilMsgSession[],
    bot: OneBotBaseBot,
  ): Promise<h[]> => {
    const result = await Promise.all(
      sessions.map(async (session) => {
        const author = h('author', {
          id: session.event.user!.id,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          name: session.event.user!.nick || session.event.user!.name,
          avatar: session.event.user!.avatar,
        })

        const elements = await this.#processOneBotMessages(
          session.event.message!.elements!,
          bot,
          0,
        )

        const message: h = (
          <message>
            {author}
            {elements}
          </message>
        )

        return message
      }),
    )

    return result
  }

  #processOneBotMessages = async (
    elements: h[],
    bot: OneBotBaseBot,
    createdCount: number,
  ) => {
    const result: h[] = []

    for (const elem of elements) {
      if (elem.type === 'forward' && elem.attrs['id']) {
        try {
          const oneBotForwardMsg = (
            await bot.internal.getForwardMsg(elem.attrs['id'])
          ).message

          const messages = await this.#parseOneBotIntl(
            oneBotForwardMsg,
            bot,
            createdCount,
          )

          result.push(
            <message forward id={elem.attrs['id']}>
              {messages}
            </message>,
          )
        } catch (e) {
          this.#l.error(`error processing ob forward ${elem.attrs['id']}`)
          this.#l.error(e)

          result.push(
            <nekoil:failedfwd platform="onebot" id={elem.attrs['id']} />,
          )
        }
      } else {
        result.push(elem)
      }
    }

    return result
  }

  /**
   * @returns 消息元素的数组，其中每个消息元素的类型都为 message，children 中首个元素为 author
   */
  #parseTelegramForward = async (
    sessions: NekoilMsgSession[],
    bot: TelegramBot,
  ): Promise<h[]> => {
    /**
     * false：头像链接获取失败
     */
    const avatarMap: Record<string, string | false> = {}
    let avatarQueue = Promise.resolve()

    const result = await Promise.all(
      sessions.map(async (session) => {
        let avatar = avatarMap[session.event.user!.id]

        if (!avatar) {
          if (avatar === false) {
            avatar = undefined
          } else {
            avatarQueue = avatarQueue.then(async () => {
              try {
                const photos = await bot.internal.getUserProfilePhotos({
                  user_id: Number(session.event.user!.id),
                  limit: 1,
                })
                const file_id = photos.photos![0]!.sort(
                  (a, b) => b.width! - a.width!,
                )[0]!.file_id!
                const file = await bot.internal.getFile({ file_id })
                avatar = (await bot.$getFileFromPath(file.file_path!)).src
              } catch (_) {
                avatarMap[session.event.user!.id] = false
              }
            })

            await avatarQueue
          }
        }

        let author = h('author', {
          id: session.event.user!.id,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          name: session.event.user!.nick || session.event.user!.name,
          avatar,
        })

        const forward = session.event._data?.message?.forward_origin

        if (forward) {
          // 避免正在创建 cp 的用户隐私泄漏
          author = h('author')

          switch (forward.type) {
            case 'user': {
              let forwardUserAvatar = avatarMap[String(forward.sender_user.id)]

              if (!forwardUserAvatar) {
                if (forwardUserAvatar === false) {
                  forwardUserAvatar = undefined
                } else {
                  avatarQueue = avatarQueue.then(async () => {
                    try {
                      const photos = await bot.internal.getUserProfilePhotos({
                        user_id: Number(forward.sender_user.id),
                        limit: 1,
                      })
                      const file_id = photos.photos![0]!.sort(
                        (a, b) => b.width! - a.width!,
                      )[0]!.file_id!
                      const file = await bot.internal.getFile({ file_id })
                      forwardUserAvatar = (
                        await bot.$getFileFromPath(file.file_path!)
                      ).src
                    } catch (_) {
                      avatarMap[String(forward.sender_user.id)] = false
                    }
                  })

                  await avatarQueue
                }
              }
              author.attrs['id'] = forward.sender_user.id
              author.attrs['name'] =
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                `${forward.sender_user.first_name || ''} ${forward.sender_user.last_name || ''}`
              author.attrs['avatar'] = forwardUserAvatar
              break
            }

            case 'hidden_user': {
              author.attrs['name'] = forward.sender_user_name
              break
            }

            case 'channel':
            case 'chat': {
              author.attrs['name'] =
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                forward.chat.title || forward.author_signature
              break
            }
          }
        }

        const message: h = (
          <message>
            {author}
            {session.event.message!.elements}
          </message>
        )

        return message
      }),
    )

    return result
  }
}
