import type { Context } from 'koishi'
import { Schema } from 'koishi'
import * as cp from './cp'
import { NekoilPermissionService } from './services/perm'
import { UpusrService } from './services/upusr'
import { NekoilUserService } from './services/user'

export const name = 'nekoil-core'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export const apply = (ctx: Context, _config: Config) => {
  ctx.plugin(UpusrService)
  ctx.plugin(NekoilUserService)
  ctx.plugin(NekoilPermissionService)
  ctx.plugin(cp)
}
