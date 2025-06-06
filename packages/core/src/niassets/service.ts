import {
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import type { Context } from 'koishi'
import { Service } from 'koishi'
import mime from 'mime'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import type { Config } from '../config'
import { zstdCompressAsync } from '../utils'

declare module 'koishi' {
  interface Context {
    nekoilAssets: NekoilAssetsService
  }
}

export class NekoilAssetsService extends Service {
  static inject = ['database']

  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilAssets')

    this.#l = ctx.logger('nekoilAssets')
  }

  #s3 = new S3Client({})

  public uploadImg = async (src: string) => {
    try {
      const file = await this.ctx.http.file(src)
      const size = file.data.byteLength
      const fileBuffer = Buffer.from(file.data)

      // 大于 64M 的图片不处理
      if (file.data.byteLength > 67108864 /* 64M = 64*1024K = 64*1024*1024 */)
        throw new NekoilAssetsOversizedError(file.filename)

      // 算 sha256 url safe base64
      // const imgSha256 = createHash('sha256')
      //   .update(fileBuffer)
      //   .digest('hex')
      const imgHandle = createHash('sha256')
        .update(fileBuffer)
        .digest('base64url')
      let niaid: number
      let thumbhash: string
      let filename = file.filename
      const fileExt = mime.getExtension(file.type) ?? 'bin'
      let width: number
      let height: number

      // 查 niassets 表
      const cacheResult = await this.ctx.database.get(
        'niassets_v1',
        {
          handle: imgHandle,
        },
        ['niaid', 'thumbhash', 'filename', 'width', 'height'],
      )

      if (cacheResult.length) {
        // 图片已存在
        niaid = cacheResult[0]!.niaid
        filename = cacheResult[0]!.filename
        thumbhash = cacheResult[0]!.thumbhash
        width = cacheResult[0]!.width
        height = cacheResult[0]!.height
      } else {
        // 算 thumbhash
        const sharpImg = sharp(file.data)
        const sharpMetadata = await sharpImg.metadata()
        width = sharpMetadata.width!
        height = sharpMetadata.height!
        const { data: rgbaBuffer, info: sharpImgInfo } = await sharpImg
          .resize(100, 100, { fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const thumbWidth = sharpImgInfo.width
        const thumbHeight = sharpImgInfo.height

        const binaryThumbHash = rgbaToThumbHash(
          thumbWidth,
          thumbHeight,
          rgbaBuffer,
        )
        thumbhash = Buffer.from(binaryThumbHash).toString('base64')

        // 上传
        await this.#s3.send(
          new PutObjectCommand({
            Bucket: this.nekoilConfig.assets.bucketId,
            Key: `v1/${imgHandle}.${fileExt}`,
            Body: await zstdCompressAsync(fileBuffer),
          }),
        )

        // niassets 入库
        const niassets = await this.ctx.database.create('niassets_v1', {
          type: 1,
          handle: imgHandle,
          size,
          filename,
          mime: file.type,
          thumbhash,
          width,
          height,
        })
        niaid = niassets.niaid
      }

      return {
        src: `internal:nekoil/2/${imgHandle}.${fileExt}`,
        title: filename,
        width,
        height,
        thumbhash,
        niaid,
      }
    } catch (e) {
      if (e instanceof NekoilAssetsError) throw e

      if (e instanceof S3ServiceException)
        this.#l.error('caused by S3ServiceException.')

      throw e
    }
  }
}

export class NekoilAssetsError extends Error {}

export class NekoilAssetsOversizedError extends NekoilAssetsError {
  constructor(public filename: string) {
    super()
  }
}
