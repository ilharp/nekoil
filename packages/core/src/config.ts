import { Schema } from 'koishi'

export interface Config {
  env: string
  proxyToken: string
  assets: {
    endpoint: string
    bucketId: string
  }
  cpimgrUrl: string
}

export const Config: Schema<Config> = Schema.object({
  env: Schema.string().default('production'),
  proxyToken: Schema.string().required(),
  assets: Schema.object({
    endpoint: Schema.string().required(),
    bucketId: Schema.string().required(),
  }),
  cpimgrUrl: Schema.string().required(),
})
