import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { ContentPackWithFull, CpimgrPayload } from 'nekoil-typedef'
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
    const measure = (await this.ctx.http.post(
      this.nekoilConfig.cpimgrUrl + '/measure',
      {
        cpssrUrl: this.nekoilConfig.cpssrUrl,
        cpwfData: data,
        proxyToken: this.nekoilConfig.proxyToken,
        internalToken: this.nekoilConfig.internalToken,
        selfUrlInternal: this.nekoilConfig.selfUrlInternal,
        showMoreTip: false,
      } satisfies CpimgrPayload,
    )) as unknown as {
      height: number
    }

    const image = (
      await this.ctx.http(this.nekoilConfig.cpimgrUrl + '/render', {
        method: 'POST',
        data: {
          cpssrUrl: this.nekoilConfig.cpssrUrl,
          cpwfData: data,
          proxyToken: this.nekoilConfig.proxyToken,
          internalToken: this.nekoilConfig.internalToken,
          selfUrlInternal: this.nekoilConfig.selfUrlInternal,
          showMoreTip: measure.height === 960,
        } satisfies CpimgrPayload,
        responseType: 'arraybuffer',
      })
    ).data

    return [image]
  }
}
