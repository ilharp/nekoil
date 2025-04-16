import type { Context, User } from 'koishi'
import { Service } from 'koishi'
import type {} from './upusr'

export interface NekoilUser {
  cordisUser: User
}

declare module 'koishi' {
  interface Context {
    nekoilUser: NekoilUserService
  }
}

export class NekoilUserService extends Service {
  static inject = ['upusr']

  constructor(ctx: Context) {
    super(ctx, 'nekoilUser')
  }

  getUser = async (
    platform: string,
    pid: string,
    {}: {} = {},
  ): Promise<NekoilUser> => {
    const cordisUser = await this.ctx.upusr.upsertUser(platform, pid)

    return {
      cordisUser,
    }
  }
}
