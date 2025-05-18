import type { Context } from 'koishi'
import { Service } from 'koishi'
import { S3Client } from '@aws-sdk/client-s3'

declare module 'koishi' {
  interface Context {
    nekoilAssets: NekoilAssetsService
  }
}

export class NekoilAssetsService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'nekoilAssets')
  }

  s3 = new S3Client({})
}
