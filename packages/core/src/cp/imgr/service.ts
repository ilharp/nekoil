import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { ContentPackWithFull, CpimgrPayload } from 'nekoil-typedef'
import type { BoundingBox } from 'puppeteer-core'
import type { Config } from '../../config'

declare module 'koishi' {
  interface Context {
    nekoilCpImgr: NekoilCpImgrService
  }
}

export class NekoilCpImgrService extends Service {
  // @ts-ignore
  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilCpImgr')
    this.#l = ctx.logger('nekoilCpImgr')
  }

  public render = async (data: ContentPackWithFull) => {
    // @ts-ignore
    const measure = (await this.ctx.http.post(
      this.nekoilConfig.cpimgrUrl + '/measure',
      {
        cpssrUrl: this.nekoilConfig.cpssrUrl,
        cpwfData: data,
        proxyToken: this.nekoilConfig.proxyToken,
        internalToken: this.nekoilConfig.internalToken,
      } satisfies CpimgrPayload,
    )) as unknown as Record<string, BoundingBox>

    const image = (
      await this.ctx.http(this.nekoilConfig.cpimgrUrl + '/render', {
        method: 'POST',
        data: {
          cpssrUrl: this.nekoilConfig.cpssrUrl,
          cpwfData: data,
          proxyToken: this.nekoilConfig.proxyToken,
          internalToken: this.nekoilConfig.internalToken,
        } satisfies CpimgrPayload,
        responseType: 'arraybuffer',
      })
    ).data

    return [image]
  }
}
