import type { Context } from 'koishi'
import { Service } from 'koishi'
import type TelegramBot from 'koishi-plugin-nekoil-adapter-telegram'
import type { InlineKeyboardMarkup } from 'koishi-plugin-nekoil-adapter-telegram'
import { escape } from 'lodash-es'
import type {
  ContentPackHandleV1,
  ContentPackWithFull,
  CpimgrPayload,
} from 'nekoil-typedef'
import type { Config } from '../../config'
import type { ReplyParameters } from '../../utils'
import { getHandle } from '../../utils'

declare module 'koishi' {
  interface Context {
    nekoilCpImgr: NekoilCpImgrService
  }
}

export class NekoilCpImgrService extends Service {
  static inject = ['database', 'nekoilAssets', 'nekoilCp']

  // @ts-ignore
  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilCpImgr')
    this.#l = ctx.logger('nekoilCpImgr')
  }

  public render = async (data: ContentPackWithFull) => {
    const measure = (await this.ctx.http.post(
      this.nekoilConfig.cpimgrUrl + '/measure',
      {
        cpssrUrl: this.nekoilConfig.cpssrUrl,
        cpwfData: data,
        proxyToken: this.nekoilConfig.proxyToken,
        internalToken: this.nekoilConfig.internalToken,
        selfUrlInternal: this.nekoilConfig.selfUrlInternal,
        showMoreTip: false,
      } satisfies CpimgrPayload,
    )) as unknown as {
      height: number
    }

    const image = (
      await this.ctx.http(this.nekoilConfig.cpimgrUrl + '/render', {
        method: 'POST',
        data: {
          cpssrUrl: this.nekoilConfig.cpssrUrl,
          cpwfData: data,
          proxyToken: this.nekoilConfig.proxyToken,
          internalToken: this.nekoilConfig.internalToken,
          selfUrlInternal: this.nekoilConfig.selfUrlInternal,
          showMoreTip: measure.height === 960,
        } satisfies CpimgrPayload,
        responseType: 'arraybuffer',
      })
    ).data

    return [image]
  }

  #sendCpssrUsingJson = async (
    payload: NekoilCpImgrServiceCpssrPayload,
    handle: string,
    tgFileId: string,
  ) => {
    const { bot, cpwf, chatId, replyParameters } = payload

    if (chatId) {
      await bot.internal.sendPhoto({
        chat_id: chatId,
        // @ts-expect-error
        reply_parameters: replyParameters,
        photo: tgFileId,
        caption: `<a href="${this.ctx.nekoilCp.getTgStartAppUrl(handle)}"><b>${escape(cpwf.summary.title)}</b></a>`,
        parse_mode: 'HTML',
        show_caption_above_media: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `查看 ${cpwf.summary.count} 条聊天记录`,
                url: this.ctx.nekoilCp.getTgStartAppUrl(handle),
              },
              {
                text: '转发',
                switch_inline_query: handle,
              },
            ],
          ],
        },
      })
    }
  }

  #sendCpssrUsingFormAndSave = async (
    payload: NekoilCpImgrServiceCpssrPayload,
    handle: string,
    image: ArrayBuffer,
    niaid: number,
  ) => {
    const { bot, cpwf, chatId, replyParameters } = payload

    if (chatId) {
      const formData = new FormData()
      formData.append('chat_id', String(chatId))
      if (replyParameters)
        formData.append('reply_parameters', JSON.stringify(replyParameters))
      formData.append(
        'caption',
        `<a href="${this.ctx.nekoilCp.getTgStartAppUrl(handle)}"><b>${escape(cpwf.summary.title)}</b></a>`,
      )
      formData.append('parse_mode', 'HTML')
      formData.append('show_caption_above_media', 'true')
      formData.append(
        'reply_markup',
        JSON.stringify({
          inline_keyboard: [
            [
              {
                text: `查看 ${cpwf.summary.count} 条聊天记录`,
                url: this.ctx.nekoilCp.getTgStartAppUrl(handle),
              },
              {
                text: '转发',
                switch_inline_query: handle,
              },
            ],
          ],
        } satisfies InlineKeyboardMarkup),
      )

      formData.append('photo', 'attach://i.png')
      formData.append(
        'i.png',
        new Blob([image], {
          type: 'image/png',
        }),
        'i.png',
      )

      // @ts-expect-error
      const sendPhotoResult = await bot.internal.sendPhoto(formData)

      await this.ctx.database.set('niassets_v1', niaid, {
        tg_file_id: sendPhotoResult.photo!.sort(
          (a, b) => b.width! - a.width!,
        )[0]!.file_id,
      })
    }
  }

  public sendCpssr = async (payload: NekoilCpImgrServiceCpssrPayload) => {
    const { cpwf, handle: originalHandle } = payload

    const handle =
      typeof originalHandle === 'string'
        ? originalHandle
        : getHandle(originalHandle)

    // 先看是不是已经存 nia 了
    if (cpwf.cpssr_niaid) {
      // 存 nia 了，那传 tg 了吗
      const [nia] = await this.ctx.database.get(
        'niassets_v1',
        cpwf.cpssr_niaid,
        ['tg_file_id', 'filename', 'mime'],
      )

      if (nia!.tg_file_id) {
        // 传 tg 了，直接发
        await this.#sendCpssrUsingJson(payload, handle, nia!.tg_file_id)
      } else {
        // 没传 tg，传下 tg 然后存一下
        const { data: image } = await this.ctx.nekoilAssets.get(nia!)

        await this.#sendCpssrUsingFormAndSave(
          payload,
          handle,
          image,
          cpwf.cpssr_niaid,
        )
      }
    } else {
      // 没存 nia，那可能是
      // a. 首次生成
      // b. 生成是在 qq，没人可 notif
      // c. v1.1 以前的 cp
      // d. 上次 cpssr 生成失败了

      const [image] = await this.render(cpwf)

      const niaResult = await this.ctx.nekoilAssets.uploadImg({
        data: image!,
        filename: '0.png',
        type: 'image/png',
      })

      await this.ctx.database.set('cp_v1', cpwf.cpid, {
        cpssr_niaid: niaResult.niaid,
      })

      await this.ctx.database.create('niassets_rc_v1', {
        niaid: niaResult.niaid,
        ref: cpwf.cpid,
        ref_type: 2, // cpssr
      })

      await this.#sendCpssrUsingFormAndSave(
        payload,
        handle,
        image!,
        niaResult.niaid,
      )
    }
  }
}

export interface NekoilCpImgrServiceCpssrPayload {
  bot: TelegramBot
  cpwf: ContentPackWithFull
  handle: string | Pick<ContentPackHandleV1, 'handle' | 'handle_type'>
  chatId?: number | string | undefined
  replyParameters?: ReplyParameters | undefined
}
