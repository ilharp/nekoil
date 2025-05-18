import type { Context } from 'koishi'
import * as controller from './controller'
import * as db from './db'
import { NekoilAssetsService } from './service'

export const name = 'nekoil-assets'

export const apply = (ctx: Context) => {
  ctx.plugin(db)
  ctx.plugin(NekoilAssetsService)
  ctx.plugin(controller)
}
