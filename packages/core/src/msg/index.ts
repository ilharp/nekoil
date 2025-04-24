import type { Context } from 'koishi'
import * as middleware from './middleware'
import { NekoilMsgService } from './service'

export const name = 'nekoil-msg'

export const apply = async (ctx: Context) => {
  ctx.plugin(NekoilMsgService)
  ctx.plugin(middleware)
}
