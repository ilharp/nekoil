import type { Context } from 'koishi'
import type { Config } from '../config'
import * as controller from './controller'
import * as db from './db'
import * as imgr from './imgr'
import * as msg from './msg'
import { NekoilCpService } from './service'
import * as tg from './tg'

export const name = 'nekoil-cp'

export const apply = (ctx: Context, config: Config) => {
  ctx.plugin(db)
  ctx.plugin(NekoilCpService, config)
  ctx.plugin(controller, config)
  ctx.plugin(tg, config)
  ctx.plugin(msg, config)
  ctx.plugin(imgr, config)
}
