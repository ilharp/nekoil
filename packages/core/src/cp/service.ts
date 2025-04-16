import type { Context, FlatKeys } from 'koishi'
import { $, Service } from 'koishi'
import type {
  ContentPackV1,
  ContentPackWithFull,
  NekoilCpCpGetResponse,
  NekoilResponseBody,
} from 'nekoil-typedef'

declare module 'koishi' {
  interface Context {
    nekoilCp: NekoilCpService
  }
}

export class NekoilCpService extends Service {
  static inject = ['nekoilUser']

  constructor(ctx: Context) {
    super(ctx, 'nekoilCp')
  }

  cpGet = async (
    platform: string,
    pid: string,
    query: string,
    full = false,
    {}: {} = {},
  ): Promise<NekoilResponseBody<NekoilCpCpGetResponse>> => {
    const user = await this.ctx.nekoilUser.getUser(platform, pid)

    let queryHandle = query

    // Normal prefix
    queryPrefixList.forEach(([prefix, length]) => {
      if (queryHandle.startsWith(prefix))
        queryHandle = queryHandle.slice(length)
    })

    // TODO: tg prefix

    const isPlusHandle = queryHandle.startsWith('+')
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
          $.eq(cp_v1.deleted, false),
          $.in(
            cp_v1.cpid,
            this.ctx.database
              .select('cp_handle_v1', (cp_handle_v1) =>
                $.and(
                  $.eq(cp_handle_v1.deleted, false),
                  $.eq(cp_handle_v1.handle, queryHandle),
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

    // return {
    //   code: 200,
    //   data: await this.#parse(contentPack),
    // }

    return {
      code: 200,
      data: {
        summary: {
          title: '群聊的聊天记录',
          summary: ['Nekoil: 我是 Nekoil，一个多功能的 bot。'],
        },

        full: {
          messages: [
            {
              content: '我是 Nekoil，一个多功能的 bot。',
              // @ts-expect-error We don't need user.id here
              user: {
                name: 'Nekoil',
              },
            },
          ],
        },
      },
    }
  }

  cpCreate = async () => {}

  #parse = async (cp: ContentPackV1) => {
    const result = structuredClone(cp) as unknown as ContentPackWithFull

    if (Object.hasOwn(result, 'cpid' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).cpid

    return result
  }
}

const queryPrefixList = [
  'http://390721.xyz/',
  'https://390721.xyz/',
  'http://www.390721.xyz/',
  'https://www.390721.xyz/',
].map<[string, number]>((x) => [x, x.length])
