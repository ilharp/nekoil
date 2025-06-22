import type { Context } from 'koishi'
import type { Config } from '../config'
import * as controller from './controller'
import * as db from './db'
import { NekoilSchService } from './service'

export const name = 'nekoil-sch'

export const apply = (ctx: Context, config: Config) => {
  ctx.plugin(db)
  ctx.plugin(NekoilSchService, config)
  ctx.plugin(controller, config)
}
