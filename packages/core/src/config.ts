import { Schema } from 'koishi'

export interface Config {
  assets: {
    endpoint: string
    bucketId: string
  }
}

export const Config: Schema<Config> = Schema.object({
  assets: Schema.object({
    endpoint: Schema.string().required(),
    bucketId: Schema.string().required(),
  }),
})
