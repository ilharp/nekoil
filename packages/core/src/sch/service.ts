import type { Context, User } from 'koishi'
import { $, Service, sleep } from 'koishi'
import type { BaseBot as OneBotBaseBot } from 'koishi-plugin-nekoil-adapter-onebot'
import type TelegramBot from 'koishi-plugin-nekoil-adapter-telegram'
import type { InlineKeyboardMarkup } from 'koishi-plugin-nekoil-adapter-telegram'
import { escape } from 'lodash-es'
import type { ContentPackHandleV1, ContentPackWithFull } from 'nekoil-typedef'
import type { Config } from '../config'
import { getHandle } from '../utils'

declare module 'koishi' {
  interface Context {
    nekoilSch: NekoilSchService
  }
}

export class NekoilSchService extends Service {
  static inject = [
    'database',
    'nekoilCpMsg',
    'nekoilCp',
    'nekoilCpImgr',
    'nekoilAssets',
  ]

  #l

  constructor(
    ctx: Context,
    private nekoilConfig: Config,
  ) {
    super(ctx, 'nekoilSch')

    this.#l = ctx.logger('nekoilSch')

    ctx.on('message', async (session) => {
      try {
        if (session.isDirect) return
        if (session.platform !== 'onebot') return
        if (!nekoilConfig.sch.listen.includes(Number(session.channelId))) return

        const elements = session.event.message!.elements!

        if (elements.length !== 1) return
        if (elements[0]!.type !== 'forward') return
        if (!elements[0]!.attrs['id']) return

        const resid = elements[0]!.attrs['id']! as string

        const bot = session.bot as OneBotBaseBot

        await session.observeUser(['id'])

        const forwardMsg = (await bot.internal.getForwardMsg(resid)).message

        const parsedContent = await ctx.nekoilCpMsg.parseOneBot(forwardMsg, bot)

        const { cpwf, cpHandle } = await ctx.nekoilCp.cpCreate(parsedContent, {
          cpPlatform: 3,
          idType: 'resid',
          resid,
          user: session.user! as unknown as User,
        })

        const sch = await ctx.database.create('sch_v1', {
          handle_id: cpHandle.handle_id,
          state: 1,
        })

        const renderCpwf = await ctx.nekoilCp.parseExternal(cpwf)

        const [image] = await ctx.nekoilCpImgr.render(renderCpwf)

        const niaResult = await ctx.nekoilAssets.uploadImg({
          data: image!,
          filename: '0.png',
          type: 'image/png',
        })

        await ctx.database.set('cp_v1', cpwf.cpid, {
          cpssr_niaid: niaResult.niaid,
        })

        await ctx.database.create('niassets_rc_v1', {
          niaid: niaResult.niaid,
          ref: cpwf.cpid,
          ref_type: 2, // cpssr
        })

        this.#sendReview(sch.schid, cpwf, cpHandle, niaResult.niaid, image!)
      } catch (e) {
        this.#l.error('sch recv msg failed:')
        this.#l.error(e)
      }
    })
  }

  #reviewTask = Promise.resolve()

  #sendReview = (
    schid: number,
    cpwf: ContentPackWithFull,
    cpHandle: Pick<ContentPackHandleV1, 'handle_id' | 'handle' | 'handle_type'>,
    niaid: number,
    image: ArrayBuffer,
  ) => {
    this.#reviewTask = this.#reviewTask
      .then(() => this.#sendReviewIntl(schid, cpwf, cpHandle, niaid, image))
      .catch((e: unknown) => {
        this.#l.error(
          `sch send review failed, schid ${schid}, cpid ${cpwf.cpid}`,
        )
        this.#l.error(e)
      })
      .then(() => sleep(4000))
  }

  #sendReviewIntl = async (
    schid: number,
    cpwf: ContentPackWithFull,
    cpHandle: Pick<ContentPackHandleV1, 'handle_id' | 'handle' | 'handle_type'>,
    niaid: number,
    image: ArrayBuffer,
  ) => {
    const bot = this.ctx.bots.find(
      (x) => x.platform === 'telegram',
    )! as unknown as TelegramBot

    const handle = getHandle(cpHandle)

    const formData = new FormData()
    formData.append('chat_id', String(this.nekoilConfig.sch.review))
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
              text: `🔍`,
              url: this.ctx.nekoilCp.getTgStartAppUrl(handle),
            },
            {
              text: '✔️',
              callback_data: `SA${schid}`,
            },
            {
              text: '❌',
              callback_data: `SR${schid}`,
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
      tg_file_id: sendPhotoResult.photo!.sort((a, b) => b.width! - a.width!)[0]!
        .file_id,
    })
  }

  public send = async (schid: number) => {
    const bot = this.ctx.bots.find(
      (x) => x.platform === 'telegram',
    )! as unknown as TelegramBot

    const [cpHandle] = await this.ctx.database.get(
      'cp_handle_v1',
      (cp_handle_v1) =>
        $.in(
          cp_handle_v1.handle_id,
          this.ctx.database
            .select('sch_v1', (sch_v1) => $.eq(sch_v1.schid, schid))
            .evaluate('handle_id'),
        ),
      ['cpid', 'handle', 'handle_type'],
    )

    const handle = getHandle(cpHandle!)

    const [cp] = await this.ctx.database.get('cp_v1', cpHandle!.cpid)

    const cpwf = await this.ctx.nekoilCp.parseIntl(cp!)

    const [nia] = await this.ctx.database.get('niassets_v1', cp!.cpssr_niaid, [
      'tg_file_id',
    ])

    const msg = await bot.internal.sendPhoto({
      chat_id: this.nekoilConfig.sch.target,
      photo: nia!.tg_file_id,
      caption: `<a href="${this.ctx.nekoilCp.getTgStartAppUrl(handle)}"><b>${escape(cpwf.summary.title)}</b></a>`,
      parse_mode: 'HTML',
    })

    await this.ctx.database.set('sch_v1', schid, {
      state: 4,
      message_id: msg.message_id,
    })
  }
}
