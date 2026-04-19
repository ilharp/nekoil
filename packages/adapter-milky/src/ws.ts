import { Adapter, Schema, Context } from 'koishi'
import { MilkyBot } from './bot'
import { adaptSession } from './utils'
import { Event } from '@saltify/milky-types'

export class WsClient<C extends Context = Context> extends Adapter.WsClient<C, MilkyBot<C>> {
  async prepare() {
    const { protocol, host } = new URL(this.bot.config.endpoint)
    let url = (protocol === 'https:' ? 'wss://' : 'ws://') + host + '/event'
    if (this.bot.config.token !== undefined && this.bot.config.token !== '') {
      url = `${url}?access_token=${encodeURIComponent(this.bot.config.token)}`
    }
    return this.bot.http.ws(url)
  }

  async accept() {
    this.socket.addEventListener('message', async ({ data }) => {
      const parsed: Event = JSON.parse(data)

      this.bot.dispatch(this.bot.session({
        type: 'internal',
        _type: `milky/${parsed.event_type.replaceAll('_', '-')}`,
        _data: parsed.data
      }))

      const session = await adaptSession(this.bot, parsed)
      if (session) this.bot.dispatch(session)
    })

    await this.bot.getLogin()
    this.bot.online()
  }
}

export namespace WsClient {
  export interface Options extends Adapter.WsClientConfig {
  }

  export const Options: Schema<Options> = Schema.intersect([
    Adapter.WsClientConfig
  ])
}
