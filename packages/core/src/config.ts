import { Schema } from 'koishi'

export interface Config {
  env: string
  tgBotName: string
  proxyToken: string
  internalToken: string
  selfUrlInternal: string
  assets: {
    endpoint: string
    bucketId: string
  }
  cpimgrUrl: string
  cpssrUrl: string
  sch: {
    listen: number[]
    admins: number[]
    review: number
    target: string
  }
}

export const Config: Schema<Config> = Schema.object({
  env: Schema.string().required(),
  tgBotName: Schema.string().required(),
  proxyToken: Schema.string().required(),
  internalToken: Schema.string().required(),
  selfUrlInternal: Schema.string().required(),
  assets: Schema.object({
    endpoint: Schema.string().required(),
    bucketId: Schema.string().required(),
  }),
  cpimgrUrl: Schema.string().required(),
  cpssrUrl: Schema.string().required(),
  sch: Schema.object({
    listen: Schema.array(Number).role('table').required(),
    admins: Schema.array(Number).role('table').required(),
    review: Schema.number().required(),
    target: Schema.string().required(),
  }),
})
