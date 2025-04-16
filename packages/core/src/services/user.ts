import type { Context, User } from 'koishi'
import { Service } from 'koishi'

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

  getUser = () => {}
}
