import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { Config } from '../../config'
import type { ContentPackWithFull } from 'nekoil-typedef'

export class NekoilCpImgrService extends Service {
  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilCpImgr')
  }

  public render = async (data: ContentPackWithFull) => {
    const image = await this.ctx.http(this.nekoilConfig.cpimgrUrl, {
      data,
      responseType: 'arraybuffer',
    })

    return image
  }
}
