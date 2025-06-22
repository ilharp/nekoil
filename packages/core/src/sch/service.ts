import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { Config } from '../config'

declare module 'koishi' {
  interface Context {
    nekoilSch: NekoilSchService
  }
}

export class NekoilSchService extends Service {
  static inject = ['database']

  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilSch')

    this.#l = ctx.logger('nekoilSch')
  }

  protected override async start() {}
}
