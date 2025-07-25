import {
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import type { FileResponse } from '@koishijs/plugin-http'
import type { Context } from 'koishi'
import { Service } from 'koishi'
import mime from 'mime'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import type { Config } from '../config'
import { zstdCompressAsync, zstdDecompressAsync } from '../utils'
import { NiAssetsV1 } from 'nekoil-typedef'

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

  public get = async (
    filename: Pick<NiAssetsV1, 'filename' | 'mime'> | string,
  ) => {
    let parsedFilename: string

    if (typeof filename === 'string') {
      parsedFilename = filename
    } else {
      parsedFilename = `${filename.filename}.${mime.getExtension(filename.mime) ?? 'bin'}`
    }

    const fileRes = await this.ctx.http(
      `${this.nekoilConfig.assets.endpoint}/v1/${parsedFilename}`,
      {
        responseType: 'arraybuffer',
      },
    )

    return {
      data: await zstdDecompressAsync(fileRes.data),
      headers: fileRes.headers.entries(),
    }
  }

  #uploadImgIntl = async (
    src: string | FileResponse,
  ): Promise<NekoilAssetsUploadImgResult> => {
    try {
      const file = typeof src === 'string' ? await this.ctx.http.file(src) : src
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

  /**
   * TODO: 先加一把全局大锁，后面用一个 map 解决这个问题，
   * 进函数之前先把 map 的 src 键设为当前 task，这样就解决了
   *
   * 函数跑完以后别忘了清理 map
   *
   * 注意 map 要放 redis 里
   */
  #uploadImgQueue = Promise.resolve(
    undefined as unknown as NekoilAssetsUploadImgResult,
  )

  public uploadImg = async (src: string | FileResponse) => {
    const task = this.#uploadImgQueue.then(async () => this.#uploadImgIntl(src))
    this.#uploadImgQueue = task.catch(
      // 这个值使用者不会取到的，给 undefined 就行
      () => undefined as unknown as NekoilAssetsUploadImgResult,
    )
    return await task
  }

  /**
   *
   * @param imgMap false：文件下载失败
   */
  public uploadImgWithFileMap = async (
    src: string,
    imgMap: Record<string, NekoilAssetsUploadImgResult | false>,
  ) => {
    let result = imgMap[src]
    if (result === false) throw new NekoilAssetsCachedFailedError()
    if (!result) {
      result = await this.uploadImg(src)
      imgMap[src] = result
    }
    return result
  }
}

export class NekoilAssetsError extends Error {}

export class NekoilAssetsCachedFailedError extends NekoilAssetsError {}

export class NekoilAssetsOversizedError extends NekoilAssetsError {
  constructor(public filename: string) {
    super()
  }
}

export interface NekoilAssetsUploadImgResult {
  src: string
  title: string
  width: number
  height: number
  thumbhash: string
  niaid: number
}
