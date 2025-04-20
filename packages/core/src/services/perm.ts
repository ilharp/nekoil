import type { Context } from 'koishi'
import { Service } from 'koishi'

declare module 'koishi' {
  interface Context {
    nekoilPerm: NekoilPermissionService
  }

  interface User {
    nekoilAuthority: number
  }
}

// 10: 运维
// 07: 猫猫
// 04: 普通用户
// 03: 被静音的用户
// 02: 被警告的用户
// 01: 被封禁的用户
// 00: 不存在的用户（无需登录的路由）

export class NekoilPermissionService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'nekoilPerm')

    ctx.model.extend('user', {
      nekoilAuthority: {
        type: 'unsigned',
        length: 1,
      },
    })

    ctx.permissions.define('authority:(value)', {
      // check: ({ value }, { user }: Partial<Session<'nekoilAuthority'>>) => {
      //   return !user || user.nekoilAuthority >= +value
      // },

      list: () =>
        Array(10)
          .fill(0)
          .map((_, i) => `authority:${i}`),
    })
  }
}
