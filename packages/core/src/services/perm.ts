import type { Context, Session } from 'koishi'
import { Service } from 'koishi'

declare module 'koishi' {
  interface Context {
    nekoilPerm: NekoilPermissionService
  }

  interface User {
    nekoilAuthority: number
  }
}

// 9: 运维
// 7: 猫猫
// 4: 普通用户
// 3: 被静音的用户
// 2: 被警告的用户
// 1: 被封禁的用户
// 0: 不存在的用户（无需登录的路由）

export class NekoilPermissionService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'nekoilPerm')

    ctx.model.extend('user', {
      nekoilAuthority: {
        type: 'unsigned',
        length: 1,
      },
    })

    // Koishi 在 attach 阶段默认只 observe ['id', 'flag', 'authority', 'permissions', 'locales']，
    // 权限检查（command/execute 里的 permissions.test）读取的是 observe 后的 session.user，
    // 必须把自定义字段加进收集列表，否则 check 里 user.nekoilAuthority 永远是 undefined。
    ctx.before('attach-user', (session, fields) => {
      fields.add('nekoilAuthority')
    })

    ctx.permissions.define('nekoil:(value)', {
      // 注意 value 是字符串（createMatch 的捕获组），需要 +value 转数字。
      // @ts-expect-error koishi 内置 Check<P> 的第二参数声明为 Partial<Session>（U=never），
      // 与这里更精确的字段标注存在逆变冲突；内置 authority:(value) 同样如此，运行时行为一致。
      check: ({ value }, { user }: Partial<Session<'nekoilAuthority'>>) => {
        return !user || user.nekoilAuthority >= +value
      },

      list: () =>
        Array(10)
          .fill(0)
          .map((_, i) => `nekoil:${i}`),
    })
  }
}
