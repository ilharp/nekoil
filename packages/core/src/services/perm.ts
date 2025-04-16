import type { Context } from 'koishi'
import { Service } from 'koishi'

declare module 'koishi' {
  interface Context {
    nekoilPerm: NekoilPermissionService
  }
}

export class NekoilPermissionService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'nekoilPerm')

    ctx.permissions.define('')
  }
}
