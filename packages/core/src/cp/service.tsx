import type { Message } from '@satorijs/protocol'
import type { Context, FlatKeys, User } from 'koishi'
import { $, h, Service } from 'koishi'
import type {} from 'koishi-plugin-redis'
import type {
  ContentPackFull,
  ContentPackHandleV1,
  ContentPackSummary,
  ContentPackV1,
  ContentPackWithAll,
  ContentPackWithFull,
  ContentPackWithSummary,
  NekoilResponseBody,
} from 'nekoil-typedef'
import type { NekoilUser } from '../services/user'
import { ellipsis, generateHandle, getHandle, NoLoggingError } from '../utils'
import { summaryMessagerSend } from './summary'

declare module 'koishi' {
  interface Context {
    nekoilCp: NekoilCpService
  }
}

export class NekoilCpService extends Service {
  static inject = ['database']

  #l

  constructor(ctx: Context) {
    super(ctx, 'nekoilCp')

    this.#l = ctx.logger('nekoilCp')
  }

  public cpGet = async <TFull extends boolean = false>(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    user: NekoilUser,
    query: string,
    full: TFull = false as TFull,
    {}: {} = {},
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
          queryHandle = queryHandle.slice(length)
      })

      // TODO: tg prefix

      const isPlusHandle = queryHandle.startsWith('_')
      if (isPlusHandle) queryHandle = queryHandle.slice(1)

      // Join ver.
      //
      // const [handle] = await this.ctx.database
      //   .join(['cp_handle_v1', 'cp_v1'], (cp_handle_v1, cp_v1) =>
      //     $.and(
      //       $.eq(cp_handle_v1.deleted, false),
      //       $.eq(cp_handle_v1.handle, queryHandle),
      //       $.eq(cp_handle_v1.cpid, cp_v1.cpid),
      //     ),
      //   )
      //   .execute()

      // Subquery ver.
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
        data: await this.#parse(contentPack),
      }
    } catch (e) {
      if (!(e instanceof NoLoggingError)) this.#l.error(e)

      return {
        code: 500,
        msg: 'EXXXXX INTERNAL SERVER ERROR',
      }
    }
  }

  public cpCreate = (
    content: h[],
    option: CpCreateOption,
  ): Promise<CpCreateResult> =>
    this.#cpCreateIntl(
      content.map((x) => h.parse(x.toString())[0]!),
      option,
      { createdCount: 0 },
    )

  /**
   * @param content `<message>` 构成的数组。
   */
  #cpCreateIntl = async (
    content: h[],
    option: CpCreateOption,
    state: CpCreateStateIntl,
  ): Promise<CpCreateResult> => {
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
      content.map(async (elem, index) => {
        const author = elem.children.find((x) => x.type === 'author')
        let elements = elem.children.filter((x) => x !== author)

        elements = await this.#processMessages(elements, { option, state })

        const protocolMessage: Message = {
          content: elements.join(''),
          user: {
            id: author?.attrs['id'],
            name: author?.attrs['name'],
            avatar: author?.attrs['avatar'],
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
      data_full: JSON.stringify(pack.full),
    }
    delete cpCreate.full
    delete cpCreate.summary

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

  #processMessages = async (
    elements: h[],
    { option, state }: { option: CpCreateOption; state: CpCreateStateIntl },
  ): Promise<h[]> => {
    const result: h[] = []

    for (const elem of elements) {
      if (elem.type === 'message' && elem.attrs['forward']) {
        // 处理嵌套 cp
        const { cpHandle } = await this.#cpCreateIntl(
          elem.children.filter((x) => x.type === 'message'),
          option,
          state,
        )
        result.push(<nekoil:cp handle={getHandle(cpHandle)} />)
      } else if (elem.type === 'img') {
        // 处理图片
        let origins = elem.children.find((x) => x.type === 'nekoil:origins')
        if (!origins) {
          origins = <nekoil:origins />
          elem.children.unshift(origins)
        }

        result.push(elem)
      } else {
        result.push(elem)
      }
    }

    return result
  }

  #parse = async (cp: ContentPackV1): Promise<ContentPackWithFull> => {
    const result = structuredClone(cp) as unknown as ContentPackWithFull

    if (Object.hasOwn(result, 'cpid' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).cpid

    if (Object.hasOwn(result, 'creator' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).creator

    if (Object.hasOwn(result, 'owner' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).owner

    if (result.data_summary) {
      result.summary = JSON.parse(result.data_summary) as ContentPackSummary
      delete (result as Partial<ContentPackWithFull>).data_summary
    }

    if (result.data_full) {
      switch (result.data_full_mode) {
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

      delete (result as Partial<ContentPackWithFull>).data_full_mode
      delete (result as Partial<ContentPackWithFull>).data_full
    }

    return result
  }
}

const queryPrefixList = [
  'http://390721.xyz/',
  'https://390721.xyz/',
  'http://www.390721.xyz/',
  'https://www.390721.xyz/',
  'https://t.me/nekoilbot?startapp=',
].map<[string, number]>((x) => [x, x.length])

interface CpCreateOption {
  cpPlatform: 1 | 2 | 3
  platform: string
  pid: string
  onProgress: (text: string) => unknown
}

interface CpCreateStateIntl {
  createdCount: number
  user?: User
}

interface CpCreateResult {
  cpAll: ContentPackWithAll
  cp: ContentPackV1
  cpHandle: ContentPackHandleV1
}
