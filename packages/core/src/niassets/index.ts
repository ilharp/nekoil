import type { Context } from 'koishi'
import type { Config } from '../config'
import * as controller from './controller'
import * as db from './db'
import { NekoilAssetsService } from './service'
import * as tg from './tg'

export const name = 'nekoil-assets'

export const apply = (ctx: Context, config: Config) => {
  ctx.plugin(db)
  ctx.plugin(NekoilAssetsService, config)
  ctx.plugin(controller, config)
  ctx.plugin(tg)
}
