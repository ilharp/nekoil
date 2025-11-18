import type { Context, Dict, FlatKeys, User } from 'koishi'
import { $, h, Service } from 'koishi'
import type TelegramBot from 'koishi-plugin-nekoil-adapter-telegram'
import { escape } from 'lodash-es'
import type {
  ContentPackFull,
  ContentPackHandleV1,
  ContentPackSummary,
  ContentPackV1,
  ContentPackWithAll,
  ContentPackWithFull,
  ContentPackWithSummary,
  NekoilResponseBody,
  NekoilSatoriMessage,
  NekoilSatoriUserExt,
} from 'nekoil-typedef'
import type { Config } from '../config'
import type { NekoilAssetsUploadImgResult } from '../niassets/service'
import { NekoilAssetsOversizedError } from '../niassets/service'
import type { NekoilUser } from '../services/user'
import type { ReplyParameters } from '../utils'
import {
  ellipsis,
  generateHandle,
  getHandle,
  NoLoggingError,
  UserSafeError,
  zstdCompressAsync,
  zstdDecompressAsync,
} from '../utils'
import { summaryMessagerSend } from './summary'

declare module 'koishi' {
  interface Context {
    nekoilCp: NekoilCpService
  }
}

export class NekoilCpService extends Service {
  static inject = ['database', 'nekoilAssets']

  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilCp')

    this.#l = ctx.logger('nekoilCp')
  }

  public getTgStartAppUrl = (handle: string) =>
    `https://t.me/${this.nekoilConfig.tgBotName}?startapp=${Buffer.from(encodeURIComponent(handle)).toString('base64url')}`

  public cpGet = async <TFull extends boolean = false>(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    user: NekoilUser,
    query: string,
    full: TFull = false as TFull,
    internal = false,
  ): Promise<
    NekoilResponseBody<
      TFull extends true ? ContentPackWithFull : ContentPackWithSummary
    >
  > => {
    try {
      let queryHandle = query

      // Normal prefix
      queryPrefixList.forEach(([prefix, length]) => {
        if (queryHandle.startsWith(prefix))
          queryHandle = decodeURIComponent(queryHandle.slice(length))
      })

      tgPrefixList.forEach(([prefix, length]) => {
        if (queryHandle.startsWith(prefix))
          queryHandle = decodeURIComponent(
            Buffer.from(queryHandle.slice(length), 'base64').toString('utf-8'),
          )
      })

      const isPlusHandle = queryHandle.startsWith('_')
      if (isPlusHandle) queryHandle = queryHandle.slice(1)

      const [contentPack] = await this.ctx.database.get(
        'cp_v1',
        (cp_v1) =>
          $.and(
            $.eq(cp_v1.deleted, 0),
            $.in(
              cp_v1.cpid,
              this.ctx.database
                .select('cp_handle_v1', (cp_handle_v1) =>
                  $.and(
                    $.eq(cp_handle_v1.deleted, 0),
                    $.eq(cp_handle_v1.handle, queryHandle),
                    isPlusHandle
                      ? $.or(
                          $.eq(cp_handle_v1.handle_type, 1),
                          $.eq(cp_handle_v1.handle_type, 4),
                        )
                      : $.or(
                          $.eq(cp_handle_v1.handle_type, 2),
                          $.eq(cp_handle_v1.handle_type, 3),
                        ),
                  ),
                )
                .evaluate('cpid'),
            ),
          ),
        [
          'cpid',
          'cp_version',
          'created_time',
          'creator',
          'owner',
          'data_summary',
          'platform',
          'cpssr_version',
          'cpssr_niaid',
          full ? 'data_full_mode' : false,
          full ? 'data_full' : false,
        ].filter(
          Boolean as unknown as (
            value: string | boolean,
          ) => value is FlatKeys<ContentPackV1>,
        ),
      )

      if (!contentPack) {
        return {
          code: 404,
          msg: 'EXXXXX NOT FOUND',
        }
      }

      return {
        code: 200,
        data: internal
          ? await this.parseIntl(contentPack)
          : await this.parseExternal(contentPack),
      }
    } catch (e) {
      if (!(e instanceof NoLoggingError)) this.#l.error(e)

      return {
        code: 500,
        msg: 'EXXXXX INTERNAL SERVER ERROR',
      }
    }
  }

  public cpGetWithHandle = async <TFull extends boolean = false>(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    user: NekoilUser,
    query: string,
    full: TFull = false as TFull,
    internal = false,
  ): Promise<
    NekoilResponseBody<
      TFull extends true
        ? {
            handle: string
            cp: ContentPackWithFull
          }
        : {
            handle: string
            cp: ContentPackWithSummary
          }
    >
  > => {
    try {
      let queryHandle = query

      // Normal prefix
      queryPrefixList.forEach(([prefix, length]) => {
        if (queryHandle.startsWith(prefix))
          queryHandle = decodeURIComponent(queryHandle.slice(length))
      })

      tgPrefixList.forEach(([prefix, length]) => {
        if (queryHandle.startsWith(prefix))
          queryHandle = decodeURIComponent(
            Buffer.from(queryHandle.slice(length), 'base64').toString('utf-8'),
          )
      })

      const isPlusHandle = queryHandle.startsWith('_')
      if (isPlusHandle) queryHandle = queryHandle.slice(1)

      const [contentPack] = await this.ctx.database.get(
        'cp_v1',
        (cp_v1) =>
          $.and(
            $.eq(cp_v1.deleted, 0),
            $.in(
              cp_v1.cpid,
              this.ctx.database
                .select('cp_handle_v1', (cp_handle_v1) =>
                  $.and(
                    $.eq(cp_handle_v1.deleted, 0),
                    $.eq(cp_handle_v1.handle, queryHandle),
                    isPlusHandle
                      ? $.or(
                          $.eq(cp_handle_v1.handle_type, 1),
                          $.eq(cp_handle_v1.handle_type, 4),
                        )
                      : $.or(
                          $.eq(cp_handle_v1.handle_type, 2),
                          $.eq(cp_handle_v1.handle_type, 3),
                        ),
                  ),
                )
                .evaluate('cpid'),
            ),
          ),
        [
          'cpid',
          'cp_version',
          'created_time',
          'creator',
          'owner',
          'data_summary',
          'platform',
          'cpssr_version',
          'cpssr_niaid',
          full ? 'data_full_mode' : false,
          full ? 'data_full' : false,
        ].filter(
          Boolean as unknown as (
            value: string | boolean,
          ) => value is FlatKeys<ContentPackV1>,
        ),
      )

      if (!contentPack) {
        return {
          code: 404,
          msg: 'EXXXXX NOT FOUND',
        }
      }

      return {
        code: 200,
        data: {
          cp: internal
            ? await this.parseIntl(contentPack)
            : await this.parseExternal(contentPack),
          handle: isPlusHandle ? `_${queryHandle}` : queryHandle,
        },
      }
    } catch (e) {
      if (!(e instanceof NoLoggingError)) this.#l.error(e)

      return {
        code: 500,
        msg: 'EXXXXX INTERNAL SERVER ERROR',
      }
    }
  }

  public sendCptxt = async ({
    chatId,
    bot,
    cpwf,
    handle: originalHandle,
    replyParameters,
  }: {
    chatId: number | string | undefined
    bot: TelegramBot
    cpwf: ContentPackWithFull
    handle: string | Pick<ContentPackHandleV1, 'handle' | 'handle_type'>
    replyParameters?: ReplyParameters | undefined
  }) => {
    if (chatId) {
      const handle =
        typeof originalHandle === 'string'
          ? originalHandle
          : getHandle(originalHandle)

      await bot.internal.sendMessage({
        chat_id: chatId,
        // @ts-expect-error
        reply_parameters: replyParameters,
        text: `<a href="${this.ctx.nekoilCp.getTgStartAppUrl(handle)}"><b>${escape(cpwf.summary.title)}</b></a>\n\n${cpwf.summary.summary.map(escape).join('\n')}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `查看 ${cpwf.summary.count} 条聊天记录`,
                url: this.ctx.nekoilCp.getTgStartAppUrl(handle),
              },
              {
                text: '转发',
                switch_inline_query: handle,
              },
            ],
          ],
        },
        link_preview_options: {
          is_disabled: true,
        },
      })
    }
  }

  public cpCreate = async (
    content: h[],
    option: CpCreateOption,
  ): Promise<CpCreateResult> => {
    const result = await this.#cpCreateIntl(
      content.map((x) => h.parse(x.toString())[0]!),
      option,
      {
        createdCount: 0,
        imgMap: {},
        imgQueue:
          Promise.resolve() as unknown as Promise<NekoilAssetsUploadImgResult>,
      },
    )

    return result
  }

  /**
   * @param 消息元素的数组，其中每个消息元素的类型都为 message，children 中可能有首个元素为 author
   */
  #cpCreateIntl = async (
    content: h[],
    option: CpCreateOption,
    state: CpCreateState,
  ): Promise<CpCreateResult> => {
    state.createdCount++

    if (state.createdCount > 1)
      option.onProgress?.(`正在创建 ${state.createdCount} 组记录。`)

    let handle_type: number
    let handle: string | undefined

    switch (option.idType) {
      case 'unlisted': {
        handle_type = 1
        handle = undefined
        break
      }
      case 'resid': {
        handle_type = 3
        handle = option.resid
        break
      }
    }

    if (handle) {
      // 固定 handle
      // 先来查一下 handle 是否已经存在了
      const [existedHandle] = await this.ctx.database.get(
        'cp_handle_v1',
        {
          handle,
        },
        ['handle_id', 'handle', 'handle_type', 'deleted'],
      )

      if (existedHandle) {
        // 看下 deleted
        if (existedHandle.deleted) {
          // deleted 了的 handle 应该在 delete 的时候就被挪到另一张表里了，这里不该出现 deleted
          // 总之先抛出异常吧
          throw new Error(
            `deleted cp_handle found in table cp_handle_v1, id ${existedHandle.handle_id}`,
          )
        }

        // 看下 handle_type
        if (existedHandle.handle_type !== handle_type) {
          // 这个也不可能出现，也抛出异常
          throw new Error(
            `found existed cp_handle ${existedHandle.handle_id} type ${existedHandle.handle_type}, but want to insert type ${handle_type}`,
          )
        }

        // 现在 existedHandle 就是足够使用的了，直接拿到足够的数据返回即可
        const [cp] = await this.ctx.database.get('cp_v1', (cp_v1) =>
          $.and(
            $.eq(cp_v1.deleted, 0),
            $.in(
              cp_v1.cpid,
              this.ctx.database
                .select('cp_handle_v1', (cp_handle_v1) =>
                  $.and(
                    $.eq(cp_handle_v1.deleted, 0),
                    $.eq(cp_handle_v1.handle, handle),
                    $.eq(cp_handle_v1.handle_type, handle_type),
                  ),
                )
                .evaluate('cpid'),
            ),
          ),
        )

        return {
          cpwf: await this.parseIntl(cp!),
          cp: {},
          cpHandle: {
            handle_id: existedHandle.handle_id,
            handle,
            handle_type,
          },
        }
      } else {
        // 数据库里没有 existedHandle，那么继续往下走正常创建流程
      }
    }

    // 已经存在的 cp 就不算套娃了
    // 当然循环引用不会因此而豁免，因为 processMessages 时 cp 和 cp_handle 都还没创建
    if (state.createdCount > 32) throw new UserSafeError('套娃层数超过限制。')

    const intlState: CpCreateIntlState = {
      niaids: new Set(),
    }

    const pack: Partial<ContentPackWithAll> = {
      created_time: new Date(),
      deleted: 0,
      deleted_reason: 0,

      cp_version: 1,
      data_full_mode: 1,
      platform: option.cpPlatform,

      creator: option.user.id,
      owner: option.user.id,

      cpssr_version: 1,
    }

    const messages = await Promise.all(
      content.map(async (elem, index) => {
        const author = elem.children.find((x) => x.type === 'author')
        let elements = elem.children.filter((x) => x !== author)

        elements = await this.#processMessages(
          elements,
          option,
          state,
          intlState,
        )

        const avatarOriginSrc = author?.attrs['avatar'] as string | undefined
        let avatar: string | undefined
        const nekoilUserExt = {} as NekoilSatoriUserExt

        if (avatarOriginSrc) {
          try {
            const uploadImgResult =
              await this.ctx.nekoilAssets.uploadImgWithFileMap(
                avatarOriginSrc,
                state.imgMap,
              )

            avatar = uploadImgResult.src
            nekoilUserExt.avatar_origins = [avatarOriginSrc]
            nekoilUserExt.avatar_width = uploadImgResult.width
            nekoilUserExt.avatar_height = uploadImgResult.height
            nekoilUserExt.avatar_thumbhash = uploadImgResult.thumbhash

            intlState.niaids.add(uploadImgResult.niaid)
          } catch (e) {
            this.#l.error(
              `error processing avatar img:\n${avatarOriginSrc}\nin cpPlatform ${option.cpPlatform} userid ${author?.attrs['id']}`,
            )
            this.#l.error(e)
          }
        }

        const protocolMessage: NekoilSatoriMessage = {
          content: elements.join(''),
          user: {
            id: author?.attrs['id'],
            name: author?.attrs['name'],
            avatar: avatar!,
            nekoil: nekoilUserExt,
          },
        }

        const summary =
          index < 3 &&
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          `${author?.attrs['name'] || '用户'}: ${ellipsis(
            (await summaryMessagerSend(elements))
              .join('')
              .replace(/\r/g, '')
              .replace(/\n/g, ' '),
            30,
          )}`

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
      summary: messages
        .map((x) => x.summary)
        .filter(Boolean as unknown as (x: string | false) => x is string),
    }

    const cpCreate = {
      ...pack,
      data_summary: JSON.stringify(pack.summary),
      data_full: (
        await zstdCompressAsync(Buffer.from(JSON.stringify(pack.full)))
      ).toString('base64'),
    }
    delete cpCreate.full
    delete cpCreate.summary

    const cp = await this.ctx.database.create('cp_v1', cpCreate)

    // niassets 入 ref 库
    await this.ctx.database.upsert(
      'niassets_rc_v1',
      Array.from(intlState.niaids).map((niaid) => ({
        niaid,
        ref_type: 1, // cp
        ref: cp.cpid,
      })),
      ['niaid', 'ref_type', 'ref'],
    )

    const cpHandleCreate = {
      created_time: new Date(),
      deleted: 0,
      deleted_reason: 0,

      cpid: cp.cpid,
      handle_type,
    }

    let cpHandle: ContentPackHandleV1 =
      undefined as unknown as ContentPackHandleV1

    if (handle) {
      // 上文已检查过，当前该 handle 尚未创建，不加 try 直接创建即可
      // FIXME: 解决上文到这里之间的竞态问题
      cpHandle = await this.ctx.database.create('cp_handle_v1', {
        ...cpHandleCreate,
        handle,
      })
    } else {
      let success = false
      let e: unknown = undefined

      for (let i = 0; i < 5; i++) {
        const generatedHandle = generateHandle(16, true)

        try {
          cpHandle = await this.ctx.database.create('cp_handle_v1', {
            ...cpHandleCreate,
            handle: generatedHandle,
          })

          success = true
          break
        } catch (err) {
          e = err
        }
      }

      if (!success) {
        // 5 次尝试插入都失败，这不是生成重复，这是数据库错误
        throw e
      }
    }

    return {
      cpwf: {
        ...pack,
        cpid: cp.cpid,
      } as ContentPackWithAll,
      cp,
      cpHandle,
    }
  }

  #processMessages = async (
    elements: h[],
    option: CpCreateOption,
    state: CpCreateState,
    intlState: CpCreateIntlState,
  ): Promise<h[]> => {
    const messageProcessor = async (attrs: Dict, children: h[]) => {
      if (!attrs['forward']) return h('message', attrs, children)

      // 处理嵌套 cp
      const { cpHandle, cpwf } = await this.#cpCreateIntl(
        children.filter((x) => x.type === 'message'),
        {
          ...option,
          idType: 'resid',
          resid: attrs['id'],
        },
        state,
      )

      return (
        <nekoil:cp
          handle={getHandle(cpHandle)}
          title={cpwf.summary.title}
          count={cpwf.summary.count}
        >
          <nekoil:cpsummarylist>
            {cpwf.summary.summary.map((x) => (
              <nekoil:cpsummary content={x} />
            ))}
          </nekoil:cpsummarylist>
        </nekoil:cp>
      ) as h
    }

    const existedcpProcessor = async (attrs: Dict, _children: h[]) => {
      if (!attrs['handle']) return <nekoil:failedfwd platform="nekoil" />

      const res = await this.cpGet(
        undefined as unknown as NekoilUser,
        attrs['handle'],
        true,
        true,
      )

      if (res.code !== 200 || !res.data)
        return <nekoil:failedfwd platform="nekoil" id={attrs['handle']} />

      const cpwf = res.data

      return (
        <nekoil:cp
          handle={attrs['handle']}
          title={cpwf.summary.title}
          count={cpwf.summary.count}
        >
          <nekoil:cpsummarylist>
            {cpwf.summary.summary.map((x: string) => (
              <nekoil:cpsummary content={x} />
            ))}
          </nekoil:cpsummarylist>
        </nekoil:cp>
      ) as h
    }

    const imgProcessor = async (attrs: Dict, children: h[]) => {
      // 处理图片
      let origins = children.find((x) => x.type === 'nekoil:origins')
      if (!origins) {
        origins = (<nekoil:origins />)! as h
        children.unshift(origins)
      }
      const originSrc = attrs['src'] as string
      origins.children.unshift((<nekoil:origin src={originSrc} />) as h)

      // 防御性，避免 originSrc 泄漏
      attrs['src'] = ''

      try {
        const uploadImgResult =
          await this.ctx.nekoilAssets.uploadImgWithFileMap(
            originSrc,
            state.imgMap,
          )

        attrs['src'] = uploadImgResult.src
        attrs['title'] = uploadImgResult.title
        attrs['width'] = uploadImgResult.width
        attrs['height'] = uploadImgResult.height
        attrs['nekoil:thumbhash'] = uploadImgResult.thumbhash

        // niassets 入 ref 库
        intlState.niaids.add(uploadImgResult.niaid)
      } catch (e) {
        if (e instanceof NekoilAssetsOversizedError) {
          return (
            <nekoil:oversizedimg title={e.filename}>
              {children}
            </nekoil:oversizedimg>
          ) as h
        } else {
          this.#l.error(
            `error processing img:\n${originSrc}\nin cpPlatform ${option.cpPlatform} pid ${option.pid}`,
          )
          this.#l.error(e)

          return (<nekoil:failedimg>{children}</nekoil:failedimg>) as h
        }
      }

      return h('img', attrs, children)
    }

    return await h.transformAsync(elements, {
      message: messageProcessor,
      img: imgProcessor,
      'nekoil:existedcp': existedcpProcessor,
    })
  }

  /**
   * 转换 {@link ContentPackV1} 到 {@link ContentPackWithFull} - 对内
   *
   * 仅限内部用，外部要用的话调 parseExternal
   */
  public parseIntl = async (
    cp: ContentPackV1,
  ): Promise<ContentPackWithFull> => {
    const result = structuredClone(cp) as unknown as ContentPackWithFull

    if (result.data_summary) {
      result.summary = JSON.parse(result.data_summary) as ContentPackSummary
    }

    if (result.data_full) {
      switch (result.data_full_mode) {
        case 1: {
          result.full = JSON.parse(
            (
              await zstdDecompressAsync(Buffer.from(result.data_full, 'base64'))
            ).toString('utf-8'),
          ) as ContentPackFull
          break
        }

        case 2: {
          result.full = JSON.parse(result.data_full) as ContentPackFull
          break
        }

        default: {
          this.#l.error(
            `unsupported d_f_mode '${result.data_full_mode}' in cp ${cp.cpid}`,
          )
          throw new NoLoggingError()
        }
      }
    }

    return result
  }

  /**
   * 转换 {@link ContentPackV1} 到 {@link ContentPackWithFull} - 对外
   *
   * 除了 parseIntl 的逻辑外，还需要做到前端安全，把不该传给前端的去掉。包括：
   *
   * - cpid 等
   * - img 里的 origin
   */
  public parseExternal = async (
    cp: ContentPackV1,
  ): Promise<ContentPackWithFull> => {
    const result = await this.parseIntl(cp)

    if (Object.hasOwn(result, 'cpid' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).cpid

    if (Object.hasOwn(result, 'creator' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).creator

    if (Object.hasOwn(result, 'owner' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).owner

    if (result.data_summary) {
      delete (result as Partial<ContentPackWithFull>).data_summary
    }

    if (result.data_full) {
      delete (result as Partial<ContentPackWithFull>).data_full_mode
      delete (result as Partial<ContentPackWithFull>).data_full
    }

    // 让首个用户的 id 为 1，避免出现 id 为 0 的情况
    const userIdList = ['']
    const nameIdList = ['']
    // eslint-disable-next-liSSne @typescript-eslint/no-unnecessary-condition
    result.full?.messages.forEach((message) => {
      message.content = h.transform(message.content!, {
        img: buildOriginsStripper('img'),
      })

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (message.user?.nekoil?.avatar_origins)
        // @ts-expect-error 在 core 里永远存在，在前端永远不在
        delete message.user.nekoil.avatar_origins

      if (message.user.id) {
        if (message.user.id === '1094950020') {
          if (message.user.name && message.user.name !== 'QQ用户') {
            if (!nameIdList.includes(message.user.name)) {
              nameIdList.push(message.user.name)
            }
            message.user.id = String(
              nameIdList.indexOf(message.user.name) + 10000000,
            )
          } else {
            userIdList.push('')
            message.user.id = String(userIdList.length - 1)
          }
        }
        if (!userIdList.includes(message.user.id)) {
          userIdList.push(message.user.id)
        }
        message.user.id = String(userIdList.indexOf(message.user.id))
      } else if (message.user?.name) {
        if (!nameIdList.includes(message.user.name)) {
          nameIdList.push(message.user.name)
        }
        message.user.id = String(
          nameIdList.indexOf(message.user.name) + 10000000,
        )
      }
    })

    return result
  }
}

const buildOriginsStripper = (t: string) => (attrs: Dict, children: h[]) =>
  h(
    t,
    attrs,
    children.filter((x) => x.type !== 'nekoil:origins'),
  )

const queryPrefixList = [
  'http://390721.xyz/',
  'https://390721.xyz/',
  'http://www.390721.xyz/',
  'https://www.390721.xyz/',
  'http://beta.390721.xyz/',
  'https://beta.390721.xyz/',
].map<[string, number]>((x) => [x, x.length])

const tgPrefixList = [
  'https://t.me/nekoilbot?startapp=',
  'https://t.me/nekoilbetabot?startapp=',
].map<[string, number]>((x) => [x, x.length])

export interface CpCreateOptionBase {
  cpPlatform: 1 | 2 | 3
  pid?: string
  onProgress?: (text: string) => unknown
  user: User
}

export type CpCreateOptionId =
  | {
      idType: 'unlisted'
    }
  | {
      idType: 'resid'
      resid: string
    }

export type CpCreateOption = CpCreateOptionBase & CpCreateOptionId

interface CpCreateState {
  createdCount: number
  /**
   * false：文件下载失败
   */
  imgMap: Record<string, NekoilAssetsUploadImgResult | false>
  imgQueue: Promise<NekoilAssetsUploadImgResult>
}

interface CpCreateIntlState {
  niaids: Set<number>
}

interface CpCreateResult {
  cpwf: ContentPackWithAll
  cp: Pick<ContentPackV1, never>
  cpHandle: Pick<ContentPackHandleV1, 'handle_id' | 'handle' | 'handle_type'>
}
