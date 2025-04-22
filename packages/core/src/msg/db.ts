import type { Context } from 'koishi'

export const name = 'nekoil-msg-db'

export const inject = ['database']

declare module 'koishi' {
  interface Tables {
    nekoil_msg_v1: MsgV1
  }
}

export interface MsgV1 {}

export const apply = async (ctx: Context) => {
  ctx.model.extend('nekoil_msg_v1', {})
}
