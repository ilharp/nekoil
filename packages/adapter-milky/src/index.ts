import { MilkyBot } from './bot'
import { Internal } from './internal'
import { Event } from '@saltify/milky-types'
import { Context } from 'koishi'
import * as Milky from './utils'

export { Milky }

export default MilkyBot

type ParamCase<S extends string> = S extends `${infer L}${infer R}` ? `${L extends '_' ? '-' : Lowercase<L>}${ParamCase<R>}` : S

type MilkyEvents<C extends Context = Context> = {
  [T in Event as `milky/${ParamCase<T['event_type']>}`]: (input: T['data'], bot: MilkyBot<C>) => void
}

declare module 'koishi' {
  interface Session {
    milky?: Event & Internal
  }
  interface Events<C> extends MilkyEvents<C> { }
}
