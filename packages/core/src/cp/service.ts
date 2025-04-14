import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { NekoilCpCpGetResponse, NekoilResponseBody } from 'nekoil-typedef'

declare module 'koishi' {
  interface Context {
    nekoilCp: NekoilCpService
  }
}

export class NekoilCpService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'nekoilCp')
  }

  cpGet = async (): Promise<NekoilResponseBody<NekoilCpCpGetResponse>> => {
    return {
      code: 200,
      data: {
        title: '群聊的聊天记录',
        summary: ['Nekoil: 我是 Nekoil，一个多功能的 bot。'],
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
    }
  }
}
