import { PutObjectCommand, S3ServiceException } from '@aws-sdk/client-s3'
import type { Message } from '@satorijs/protocol'
import type { Context, Dict, FlatKeys, User } from 'koishi'
import { $, h, Service } from 'koishi'
import type {} from 'koishi-plugin-redis'
import mime from 'mime'
import type {
  ContentPackFull,
  ContentPackHandleV1,
  ContentPackSummary,
  ContentPackV1,
  ContentPackWithAll,
  ContentPackWithFull,
  ContentPackWithSummary,
  NekoilResponseBody,
} from 'nekoil-typedef'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import type { Config } from '../config'
import type { NekoilUser } from '../services/user'
import {
  ellipsis,
  generateHandle,
  getHandle,
  NoLoggingError,
  zstdCompressAsync,
  zstdDecompressAsync,
} from '../utils'
import { summaryMessagerSend } from './summary'

declare module 'koishi' {
  interface Context {
    nekoilCp: NekoilCpService
  }
}

export class NekoilCpService extends Service {
  static inject = ['database', 'nekoilAssets']

  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilCp')

    this.#l = ctx.logger('nekoilCp')
  }

  public cpGet = async <TFull extends boolean = false>(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    user: NekoilUser,
    query: string,
    full: TFull = false as TFull,
    {}: {} = {},
  ): Promise<
    NekoilResponseBody<
      TFull extends true ? ContentPackWithFull : ContentPackWithSummary
    >
  > => {
    try {
      let queryHandle = query

      // Normal prefix
      queryPrefixList.forEach(([prefix, length]) => {
        if (queryHandle.startsWith(prefix))
          queryHandle = queryHandle.slice(length)
      })

      // TODO: tg prefix

      const isPlusHandle = queryHandle.startsWith('_')
      if (isPlusHandle) queryHandle = queryHandle.slice(1)

      // Join ver.
      //
      // const [handle] = await this.ctx.database
      //   .join(['cp_handle_v1', 'cp_v1'], (cp_handle_v1, cp_v1) =>
      //     $.and(
      //       $.eq(cp_handle_v1.deleted, false),
      //       $.eq(cp_handle_v1.handle, queryHandle),
      //       $.eq(cp_handle_v1.cpid, cp_v1.cpid),
      //     ),
      //   )
      //   .execute()

      // Subquery ver.
      const [contentPack] = await this.ctx.database.get(
        'cp_v1',
        (cp_v1) =>
          $.and(
            $.eq(cp_v1.deleted, 0),
            $.in(
              cp_v1.cpid,
              this.ctx.database
                .select('cp_handle_v1', (cp_handle_v1) =>
                  $.and(
                    $.eq(cp_handle_v1.deleted, 0),
                    $.eq(cp_handle_v1.handle, queryHandle),
                    isPlusHandle
                      ? $.or(
                          $.eq(cp_handle_v1.handle_type, 1),
                          $.eq(cp_handle_v1.handle_type, 4),
                        )
                      : $.or(
                          $.eq(cp_handle_v1.handle_type, 2),
                          $.eq(cp_handle_v1.handle_type, 3),
                        ),
                  ),
                )
                .evaluate('cpid'),
            ),
          ),
        [
          'cpid',
          'cp_version',
          'created_time',
          'creator',
          'owner',
          'data_summary',
          'platform',
          full ? 'data_full_mode' : false,
          full ? 'data_full' : false,
        ].filter(
          Boolean as unknown as (
            value: string | boolean,
          ) => value is FlatKeys<ContentPackV1>,
        ),
      )

      if (!contentPack) {
        return {
          code: 404,
          msg: 'EXXXXX NOT FOUND',
        }
      }

      return {
        code: 200,
        data: await this.#parse(contentPack),
      }
    } catch (e) {
      if (!(e instanceof NoLoggingError)) this.#l.error(e)

      return {
        code: 500,
        msg: 'EXXXXX INTERNAL SERVER ERROR',
      }
    }
  }

  public cpCreate = async (
    content: h[],
    option: CpCreateOption,
  ): Promise<CpCreateResult> => {
    const niaids: number[] = []

    const result = await this.#cpCreateIntl(
      content.map((x) => h.parse(x.toString())[0]!),
      option,
      {
        createdCount: 0,
        niaids,
      },
    )

    // niassets 入 ref 库
    await this.ctx.database.upsert(
      'niassets_rc_v1',
      niaids.map((niaid) => ({
        niaid,
        ref_type: 1, // cp
        ref: result.cp.cpid,
      })),
      ['niaid', 'ref_type', 'ref'],
    )

    return result
  }

  /**
   * @param content `<message>` 构成的数组。
   */
  #cpCreateIntl = async (
    content: h[],
    option: CpCreateOption,
    state: CpCreateStateIntl,
  ): Promise<CpCreateResult> => {
    state.createdCount++

    if (state.createdCount > 32) throw new Error('套娃层数超过限制。')

    if (state.createdCount > 1)
      option.onProgress(`正在创建 ${state.createdCount} 组记录。`)

    state.user ??= await this.ctx.database.getUser(option.platform, option.pid)

    const pack: Partial<ContentPackWithAll> = {
      created_time: new Date(),
      deleted: 0,
      deleted_reason: 0,

      cp_version: 1,
      data_full_mode: 1,
      platform: option.cpPlatform,

      creator: state.user.id,
      owner: state.user.id,
    }

    const messages = await Promise.all(
      content.map(async (elem, index) => {
        const author = elem.children.find((x) => x.type === 'author')
        let elements = elem.children.filter((x) => x !== author)

        elements = await this.#processMessages(elements, { option, state })

        const protocolMessage: Message = {
          content: elements.join(''),
          user: {
            id: author?.attrs['id'],
            name: author?.attrs['name'],
            avatar: author?.attrs['avatar'],
          },
        }

        const summary =
          index < 3 &&
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          `${author?.attrs['name'] || '用户'}: ${ellipsis(
            (await summaryMessagerSend(elements))
              .join('')
              .replace(/\r/g, '')
              .replace(/\n/g, ' '),
            30,
          )}`

        return {
          message: protocolMessage,
          summary,
        }
      }),
    )

    pack.full = {
      messages: messages.map((x) => x.message),
    }

    pack.summary = {
      count: messages.length,
      title: '群聊的聊天记录',
      summary: messages
        .map((x) => x.summary)
        .filter(Boolean as unknown as (x: string | false) => x is string),
    }

    const cpCreate = {
      ...pack,
      data_summary: JSON.stringify(pack.summary),
      data_full: (
        await zstdCompressAsync(Buffer.from(JSON.stringify(pack.full)))
      ).toString('base64'),
    }
    delete cpCreate.full
    delete cpCreate.summary

    const cp = await this.ctx.database.create('cp_v1', cpCreate)

    let handle_type: number
    let handle: string
    switch (option.idType) {
      case 'unlisted': {
        handle_type = 1
        handle = generateHandle(16, true)
        break
      }
      case 'resid': {
        handle_type = 3
        handle = option.resid
        break
      }
    }

    let cpHandle: ContentPackHandleV1
    while (true) {
      try {
        cpHandle = await this.ctx.database.create('cp_handle_v1', {
          created_time: new Date(),
          deleted: 0,
          deleted_reason: 0,

          cpid: cp.cpid,
          handle_type,
          handle,
        })

        break
      } catch (_) {
        // continue
      }
    }

    return {
      cpAll: pack as ContentPackWithAll,
      cp,
      cpHandle,
    }
  }

  #processMessages = async (
    elements: h[],
    { option, state }: { option: CpCreateOption; state: CpCreateStateIntl },
  ): Promise<h[]> => {
    const result: h[] = []

    for (const elem of elements) {
      if (elem.type === 'message' && elem.attrs['forward']) {
        // 处理嵌套 cp
        const { cpHandle } = await this.#cpCreateIntl(
          elem.children.filter((x) => x.type === 'message'),
          option,
          state,
        )
        result.push((<nekoil:cp handle={getHandle(cpHandle)} />) as h)
      } else if (elem.type === 'nekoil:tgsticker' || elem.type === 'img') {
        const isTgsticker = elem.type === 'nekoil:tgsticker'
        let img: h
        let tgsticker: h | undefined = undefined
        if (isTgsticker) {
          tgsticker = h.parse(elem.toString())[0]!
          img = tgsticker.children.find((x) => x.type === 'img')!
        } else {
          img = h.parse(elem.toString())[0]!
        }

        // 处理图片
        let origins = img.children.find((x) => x.type === 'nekoil:origins')
        if (!origins) {
          origins = (<nekoil:origins />)! as h
          img.children.unshift(origins)
        }
        const originSrc = img.attrs['src'] as string
        origins.children.unshift((<nekoil:origin src={originSrc} />) as h)

        // 防御性，避免 originSrc 泄漏
        img.attrs['src'] = ''

        try {
          const file = await this.ctx.http.file(originSrc)
          const size = file.data.byteLength
          const fileBuffer = Buffer.from(file.data)

          // https://github.com/typescript-eslint/typescript-eslint/issues/7688
          LABEL_PROCESS_IMG: {
            // 大于 64M 的图片不处理
            if (
              file.data.byteLength >
              67108864 /* 64M = 64*1024K = 64*1024*1024 */
            ) {
              img = (
                <nekoil:oversizedimg title={file.filename}>
                  {img.children}
                </nekoil:oversizedimg>
              ) as h

              break LABEL_PROCESS_IMG
            }

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
              await this.ctx.nekoilAssets.s3.send(
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

            img.attrs['src'] = `internal:nekoil/2/${imgHandle}.${fileExt}`
            img.attrs['title'] = filename
            img.attrs['width'] = width
            img.attrs['height'] = height
            img.attrs['nekoil:thumbhash'] = thumbhash

            // niassets 入 ref 库
            state.niaids.push(niaid)
          }
        } catch (e) {
          this.#l.error(
            `error processing img:\n${originSrc}\nin cpPlatform ${option.cpPlatform} platform ${option.platform} pid ${option.pid}`,
          )
          if (e instanceof S3ServiceException)
            this.#l.error('caused by S3ServiceException.')
          this.#l.error(e)
          img = (<nekoil:failedimg>{img.children}</nekoil:failedimg>) as h
        }

        result.push(isTgsticker ? tgsticker! : img)
      } else {
        result.push(elem)
      }
    }

    return result
  }

  /**
   * 转换 {@link ContentPackV1} 到 {@link ContentPackWithFull}
   *
   * 出了解压 data_ 字段以外，还需要做到前端安全，把不该传给前端的去掉。包括：
   *
   * - cpid 等
   * - img 里的 origin
   */
  #parse = async (cp: ContentPackV1): Promise<ContentPackWithFull> => {
    const result = structuredClone(cp) as unknown as ContentPackWithFull

    if (Object.hasOwn(result, 'cpid' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).cpid

    if (Object.hasOwn(result, 'creator' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).creator

    if (Object.hasOwn(result, 'owner' satisfies keyof ContentPackWithFull))
      delete (result as Partial<ContentPackWithFull>).owner

    if (result.data_summary) {
      result.summary = JSON.parse(result.data_summary) as ContentPackSummary
      delete (result as Partial<ContentPackWithFull>).data_summary
    }

    if (result.data_full) {
      switch (result.data_full_mode) {
        case 1: {
          result.full = JSON.parse(
            (
              await zstdDecompressAsync(Buffer.from(result.data_full, 'base64'))
            ).toString('utf-8'),
          ) as ContentPackFull
          break
        }

        case 2: {
          result.full = JSON.parse(result.data_full) as ContentPackFull
          break
        }

        default: {
          this.#l.error(
            `unsupported d_f_mode '${result.data_full_mode}' in cp ${cp.cpid}`,
          )
          throw new NoLoggingError()
        }
      }

      delete (result as Partial<ContentPackWithFull>).data_full_mode
      delete (result as Partial<ContentPackWithFull>).data_full
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    result.full?.messages.forEach((message) => {
      message.content = h.transform(message.content!, {
        img: buildOriginsStripper('img'),
      })
    })

    return result
  }
}

const buildOriginsStripper = (t: string) => (attrs: Dict, children: h[]) =>
  h(t, { ...attrs, 'nekoil:origins': undefined }, children)

const queryPrefixList = [
  'http://390721.xyz/',
  'https://390721.xyz/',
  'http://www.390721.xyz/',
  'https://www.390721.xyz/',
  'https://t.me/nekoilbot?startapp=',
].map<[string, number]>((x) => [x, x.length])

export interface CpCreateOptionBase {
  cpPlatform: 1 | 2 | 3
  platform: string
  pid: string
  onProgress: (text: string) => unknown
}

export type CpCreateOptionId =
  | {
      idType: 'unlisted'
    }
  | {
      idType: 'resid'
      resid: string
    }

export type CpCreateOption = CpCreateOptionBase & CpCreateOptionId

interface CpCreateStateIntl {
  createdCount: number
  user?: User
  niaids: number[]
}

interface CpCreateResult {
  cpAll: ContentPackWithAll
  cp: ContentPackV1
  cpHandle: ContentPackHandleV1
}
