import type { Context } from 'koishi'
import * as db from './db'

export const name = 'nekoil-assets'

export const apply = (ctx: Context) => {
  ctx.plugin(db)
}
