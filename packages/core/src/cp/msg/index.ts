import type { Context } from 'koishi'
import * as middleware from './middleware'
import { NekoilCpMsgService } from './service'
// import * as command from './command'

export const name = 'nekoil-cp-msg'

export const apply = async (ctx: Context) => {
  ctx.plugin(NekoilCpMsgService)
  ctx.plugin(middleware)
  // ctx.plugin(command)
}
