import {
  DeleteObjectsCommand,
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

  #assetsKey = (nia: Pick<NiAssetsV1, 'handle' | 'mime'>) =>
    `v1/${nia.handle}.${mime.getExtension(nia.mime) ?? 'bin'}`

  /**
   * 清理无引用的资源：删 S3 对象并清理 niassets_v1 表。
   *
   * 给 command 与 cron-service 两个调用方使用。
   */
  public cleanup = async (): Promise<NekoilAssetsCleanupResult> => {
    const [rcNiaids, cpssrRows, niaRows] = await Promise.all([
      this.ctx.database.get('niassets_rc_v1', {}, ['niaid']),
      // cp 删除时只移除引用行、不清 cp_v1（含 cpssr_niaid），
      // 因此这里必须限定 deleted = 0，否则已删 cp 的 cpssr 图永远清理不掉
      this.ctx.database.get('cp_v1', { deleted: 0 }, ['cpssr_niaid']),
      this.ctx.database.get('niassets_v1', {}, ['niaid', 'handle', 'mime']),
    ])

    const refNiaids = new Set<number>(rcNiaids.map((x) => x.niaid))

    // 防御：正常情况下 cpssr_niaid 都有引用行，这里兜底
    for (const row of cpssrRows)
      if (row.cpssr_niaid) refNiaids.add(row.cpssr_niaid)

    const orphans = niaRows.filter((x) => !refNiaids.has(x.niaid))

    // 先删 S3 对象、后删表行：反过来时 S3 删除失败会留下
    // 行已删但对象仍在的永久孤儿；这个顺序下失败对象的行
    // 保留在表里，等下次清理重试
    const failedKeys = new Set<string>()

    for (let i = 0; i < orphans.length; i += 1000) {
      const chunk = orphans.slice(i, i + 1000)

      try {
        const result = await this.#s3.send(
          new DeleteObjectsCommand({
            Bucket: this.nekoilConfig.assets.bucketId,
            Delete: {
              Objects: chunk.map((nia) => ({ Key: this.#assetsKey(nia) })),
            },
          }),
        )

        for (const err of result.Errors ?? []) failedKeys.add(err.Key!)
      } catch (e) {
        if (e instanceof S3ServiceException)
          this.#l.error('niassets cleanup: caused by S3ServiceException.')

        this.#l.error(e)

        for (const nia of chunk) failedKeys.add(this.#assetsKey(nia))
      }
    }

    const removedNiaids = orphans
      .filter((x) => !failedKeys.has(this.#assetsKey(x)))
      .map((x) => x.niaid)

    const failedNiaids = orphans
      .filter((x) => failedKeys.has(this.#assetsKey(x)))
      .map((x) => x.niaid)

    await this.ctx.database.remove('niassets_v1', removedNiaids)

    this.#l.info(
      `niassets cleanup: scanned ${niaRows.length}, removed ${removedNiaids.length}, failed ${failedNiaids.length}` +
        (failedNiaids.length ? ` (niaids: ${failedNiaids.join(',')})` : ''),
    )

    return {
      scanned: niaRows.length,
      removed: removedNiaids.length,
      failed: failedNiaids,
    }
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

export interface NekoilAssetsCleanupResult {
  scanned: number
  removed: number
  failed: number[]
}
