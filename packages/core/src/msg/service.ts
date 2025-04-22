import type { Context } from 'koishi'
import { Service } from 'koishi'
import { debounce } from 'lodash-es'

interface Emitter {
  fn: () => unknown
  lock: number
}

declare module 'koishi' {
  interface Context {
    nekoilMsg: NekoilMsgService
  }
}

export class NekoilMsgService extends Service {
  static inject = ['database']

  #l

  constructor(ctx: Context) {
    super(ctx, 'nekoilMsg')

    this.#l = ctx.logger('nekoilMsg')
  }

  #emitMap: Record<string, Emitter> = {}

  #getEmitter = (channel: string) => {
    if (!this.#emitMap[channel]) {
      const emitter = {
        lock: 0,
      } as Emitter
      emitter.fn = debounce(this.#buildFn(channel, emitter))
      this.#emitMap[channel] = emitter
    }
    return this.#emitMap[channel]
  }

  emit = (channel: string) => {
    this.#getEmitter(channel).fn()
  }

  lock = (channel: string) => {
    this.#getEmitter(channel).lock++
  }

  unlock = (channel: string) => {
    this.#getEmitter(channel).lock--
  }

  #buildFn = (channel: string, emitter: Emitter) => async () => {
    if (emitter.lock) return
  }
}
