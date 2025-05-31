import type { Context } from 'koishi'
import * as bind from './bind'
import type { Config } from './config'
import * as cp from './cp'
import * as niassets from './niassets'
import { NekoilPermissionService } from './services/perm'
import { UpusrService } from './services/upusr'
import { NekoilUserService } from './services/user'

export * from './config'

export const name = 'nekoil-core'

export const apply = (ctx: Context, config: Config) => {
  ctx.plugin(UpusrService)
  ctx.plugin(NekoilUserService)
  ctx.plugin(NekoilPermissionService)
  ctx.plugin(cp, config)
  ctx.plugin(niassets, config)
  ctx.plugin(bind)

  ctx.on('before-send', (session) => {
    return session.platform === 'onebot'
  })
}
