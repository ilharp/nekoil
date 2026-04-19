import { Context, h, MessageEncoder } from 'koishi'
import { MilkyBot } from './bot'
import { OutgoingSegment } from '@saltify/milky-types'

interface Author {
  id?: string
  name?: string
  avatar?: string
}

class State {
  author: Author = {}
  segments: OutgoingSegment[] = []

  constructor(public type: 'message' | 'forward') { }
}

export class MilkyMessageEncoder<C extends Context = Context> extends MessageEncoder<C, MilkyBot<C>> {
  private segments: OutgoingSegment[] = []
  private stack: State[] = [new State('message')]
  private pLength: number | undefined

  async flush() {
    if (this.pLength === this.segments.length) {
      this.segments.pop()
    }

    if (!this.segments.length && this.stack[0].type === 'message') {
      this.segments = this.stack[0].segments
    }

    this.segments = this.segments.filter(seg => seg.type !== 'text' || seg.data.text !== '')
    if (!this.segments.length) return

    if (this.stack[0].type === 'forward') {
      const uin = this.stack[0].author.id ?? this.bot.selfId
      const name = this.stack[0].author.name ?? this.bot.user.name
      if (this.stack[1].segments[0]?.type === 'forward') {
        this.stack[1].segments[0].data.messages.push({
          user_id: +uin,
          sender_name: name,
          segments: this.segments
        })
      } else {
        this.stack[1].segments.push({
          type: 'forward',
          data: {
            messages: [{
              user_id: +uin,
              sender_name: name,
              segments: this.segments
            }]
          },
        })
      }

      this.segments = []
      return
    }

    let resp: { message_seq: number, time: number }
    if (this.channelId.startsWith('private:')) {
      const userId = +this.channelId.replace('private:', '')
      resp = await this.bot.internal.sendPrivateMessage(userId, this.segments)
    } else if (this.channelId.startsWith('temporary:')) {
      const userId = +this.channelId.replace('temporary:', '')
      resp = await this.bot.internal.sendPrivateMessage(userId, this.segments)
    } else {
      resp = await this.bot.internal.sendGroupMessage(+this.channelId, this.segments)
    }
    const session = this.bot.session()
    session.messageId = resp.message_seq.toString()
    session.timestamp = resp.time * 1000
    session.userId = this.session.selfId
    session.channelId = this.session.channelId
    session.guildId = this.session.guildId
    session.app.emit(session, 'send', session)
    this.results.push(session.event.message)
    this.segments = []
    this.pLength = undefined
  }

  private text(text: string) {
    return this.segments.push({ type: 'text', data: { text } })
  }

  async visit(element: h) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.text(attrs.content)
    } else if (type === 'at') {
      if (attrs.type === 'all') {
        this.segments.push({
          type: 'mention_all',
          data: {}
        })
      } else {
        this.segments.push({
          type: 'mention',
          data: {
            user_id: +attrs.id
          }
        })
      }
    } else if (type === 'a') {
      await this.render(children)
      this.text(`（${attrs.href}）`)
    } else if (type === 'img' || type === 'image') {
      let uri = attrs.src ?? attrs.url
      const cap = /^data:([\w/.+-]+);base64,/.exec(uri)
      if (cap) uri = 'base64://' + uri.slice(cap[0].length)
      this.segments.push({
        type: 'image',
        data: {
          uri,
          sub_type: 'normal'
        }
      })
    } else if (type === 'audio') {
      await this.flush()
      let uri = attrs.src ?? attrs.url
      const cap = /^data:([\w/.+-]+);base64,/.exec(uri)
      if (cap) uri = 'base64://' + uri.slice(cap[0].length)
      this.segments.push({
        type: 'record',
        data: {
          uri
        }
      })
    } else if (type === 'video') {
      await this.flush()
      let uri = attrs.src ?? attrs.url
      const cap = /^data:([\w/.+-]+);base64,/.exec(uri)
      if (cap) uri = 'base64://' + uri.slice(cap[0].length)
      let thumbUri = attrs.poster
      const thumbCap = /^data:([\w/.+-]+);base64,/.exec(thumbUri)
      if (thumbCap) thumbUri = 'base64://' + thumbUri.slice(thumbCap[0].length)
      this.segments.push({
        type: 'video',
        data: {
          uri,
          thumb_uri: thumbUri
        }
      })
    } else if (type === 'br') {
      this.text('\n')
    } else if (type === 'p') {
      const prev = this.segments.at(-1)
      if (prev) {
        if (prev.type === 'text') {
          if (!prev.data.text.endsWith('\n')) {
            prev.data.text += '\n'
          }
        } else {
          this.text('\n')
        }
      }
      await this.render(children)
      this.pLength = this.text('\n')
    } else if (type === 'message') {
      await this.flush()
      if ('forward' in attrs) {
        this.stack.unshift(new State('forward'))
        await this.render(children)
        await this.flush()
        this.stack.shift()
        if (this.stack.length > 1) {
          const uin = this.stack[0].author.id ?? this.bot.selfId
          const name = this.stack[0].author.name ?? this.bot.user.name
          if (this.stack[1].segments[0]?.type === 'forward') {
            this.stack[1].segments[0].data.messages.push({
              user_id: +uin,
              sender_name: name,
              segments: this.stack[0].segments
            })
          } else {
            this.stack[1].segments.push({
              type: 'forward',
              data: {
                messages: [{
                  user_id: +uin,
                  sender_name: name,
                  segments: this.stack[0].segments
                }]
              },
            })
          }
        }
      } else {
        await this.render(children)
        await this.flush()
      }
    } else if (type === 'quote') {
      this.segments.push({
        type: 'reply',
        data: {
          message_seq: +attrs.id
        }
      })
    } else if (type === 'author') {
      Object.assign(this.stack[0].author, attrs)
    } else if (type === 'milky:light-app') {
      this.segments.push({
        type: 'light_app',
        data: {
          json_payload: attrs.jsonPayload
        }
      })
    } else {
      await this.render(children)
    }
  }
}
