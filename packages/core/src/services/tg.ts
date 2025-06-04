import type { Context } from 'koishi'
import { Service } from 'koishi'
import type { TelegramBot } from 'koishi-plugin-nekoil-adapter-telegram'
import type { BinaryLike } from 'node:crypto'
import { createHmac } from 'node:crypto'

declare module 'koishi' {
  interface Context {
    nekoilTg: NekoilTgService
  }
}

export class NekoilTgService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'nekoilTg')
  }

  #hmac = (data: BinaryLike, key: BinaryLike) =>
    createHmac('sha256', key).update(data).digest()

  #secretKey = undefined as unknown as Buffer

  protected override start = async (): Promise<void> => {
    const tgBot = this.ctx.bots.find(
      (x) => x.platform === 'telegram',
    )! as unknown as TelegramBot

    this.#secretKey = this.#hmac(tgBot.config.token, 'WebAppData')
  }

  public validateInitData = (initData: URLSearchParams) => {
    let hash: string | undefined
    let authDate: Date | undefined

    const values: string[] = []

    initData.forEach((value, key) => {
      if (key === 'hash') {
        hash = value
        return
      }

      if (key === 'auth_date') {
        const authDateNum = parseInt(value, 10)
        if (!Number.isNaN(authDateNum)) {
          authDate = new Date(authDateNum * 1000)
        }
      }

      values.push(`${key}=${value}`)
    })

    if (!hash || !authDate) return false

    // if (authDate.getTime() + 86400 * 1000 < Date.now()) return false

    values.sort()

    const sign = this.#hmac(values.join('\n'), this.#secretKey)

    return sign.toString('utf-8') === hash
  }
}
