import type { Context } from 'koishi'
import type { Config } from '../../config'
import * as commands from './commands'
import * as middleware from './middleware'
import { NekoilCpMsgService } from './service'

export const name = 'nekoil-cp-msg'

export const apply = async (ctx: Context, config: Config) => {
  ctx.plugin(NekoilCpMsgService, config)
  ctx.plugin(middleware)
  ctx.plugin(commands)
}
