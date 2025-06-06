import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { Config } from '../../config'

export class NekoilCpImgrService extends Service {
  constructor(ctx: Context, config: Config) {
    super(ctx, 'nekoilCpImgr')
  }

  public render = async () => {}
}
