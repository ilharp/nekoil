import type { Context } from 'koishi'
import type { Config } from '../../config'
import * as middleware from './middleware'
import { NekoilCpMsgService } from './service'
// import * as command from './command'

export const name = 'nekoil-cp-msg'

export const apply = async (ctx: Context, config: Config) => {
  ctx.plugin(NekoilCpMsgService, config)
  ctx.plugin(middleware)
  // ctx.plugin(command)
}
