import type { Context } from 'koishi'
import * as db from './db'
import * as middleware from './middleware'
import { NekoilMsgService } from './service'

export const name = 'nekoil-msg'

export const apply = async (ctx: Context) => {
  ctx.plugin(db)
  ctx.plugin(NekoilMsgService)
  ctx.plugin(middleware)
}
