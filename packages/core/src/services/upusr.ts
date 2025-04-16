import type { Context, Update, User } from 'koishi'
import { Service } from 'koishi'

declare module 'koishi' {
  interface Context {
    upusr: UpusrService
  }
}

export class UpusrService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'upusr')
  }

  getUser = async <K extends User.Field = never>(
    platform: string,
    pid: string,
    fields: K[] = [],
  ) => {
    if (!fields.length) return {} as User
    const user = (await this.ctx.database.getUser(
      platform,
      pid,
      fields,
    )) as unknown as User | undefined
    if (user) return user
    const data = {
      authority: this.ctx.root.config.autoAuthorize,
      createdAt: new Date(),
    }
    return this.ctx.database.createUser(platform, pid, data)
  }

  upsertUser = async <K extends User.Field = never>(
    platform: string,
    pid: string,
    fields: K[] = [],
    data: Update<User> = {},
  ) => {
    const user = await this.getUser(platform, pid, fields)
    await this.ctx.database.set('user', user.id, data)
    return Object.assign({} as User, user, data as User)
  }
}
