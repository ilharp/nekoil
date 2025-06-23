import type { Context } from 'koishi'
import type { Config } from '../config'
import * as commands from './commands'
import * as controller from './controller'
import * as db from './db'
import { NekoilSchService } from './service'
import * as tg from './tg'

export const name = 'nekoil-sch'

export const apply = (ctx: Context, config: Config) => {
  ctx.plugin(db)
  ctx.plugin(NekoilSchService, config)
  ctx.plugin(controller, config)
  ctx.plugin(commands)
  ctx.plugin(tg, config)
}
