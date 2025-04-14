import type { Context } from 'koishi'
import * as controller from './controller'
import * as db from './db'
import { NekoilCpService } from './service'
import * as tg from './tg'

export const name = 'nekoil-cp'

export const apply = (ctx: Context) => {
  ctx.plugin(db)
  ctx.plugin(NekoilCpService)
  ctx.plugin(controller)
  ctx.plugin(tg)
}
