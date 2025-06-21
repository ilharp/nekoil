import type { Context } from 'koishi'
import type { Config } from '../../config'
// import * as commands from './commands'
import { NekoilCpImgrService } from './service'

export const name = 'nekoil-cp-imgr'

export const apply = (ctx: Context, config: Config) => {
  ctx.plugin(NekoilCpImgrService, config)
  // ctx.plugin(commands, config)
}
