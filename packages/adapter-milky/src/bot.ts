import { Bot, Context, Schema, HTTP, Dict, Universal, isNonNullable } from 'koishi'
import { WsClient } from './ws'
import { MilkyMessageEncoder } from './message'
import { decodeFriend, decodeGroupChannel, decodeGuild, decodeGuildMember, decodeLoginUser, decodeMessage, decodePrivateChannel, decodeUser, filterNullable, getSceneAndPeerId } from './utils'
import { Internal } from './internal'
import { Direction, Order } from '@satorijs/protocol'

export class MilkyBot<C extends Context = Context> extends Bot<C, MilkyBot.Config> {
  static inject = {
    required: ['http']
  }
  static MessageEncoder = MilkyMessageEncoder
  http: HTTP
  internal: Internal

  constructor(ctx: C, config: MilkyBot.Config) {
    super(ctx, config, 'milky')
    let headers: Dict
    if (config.token !== undefined && config.token !== '') {
      headers = {
        Authorization: `Bearer ${config.token}`,
        ...config.headers
      }
    } else {
      headers = config.headers
    }
    this.http = ctx.http.extend({
      ...config,
      headers
    })
    this.internal = new Internal(this.http)
    ctx.plugin(WsClient, this)
  }

  async getChannel(channelId: string, guildId?: string) {
    const [scene, peerId] = getSceneAndPeerId(channelId)
    if (scene === 'group') {
      const data = await this.internal.getGroupInfo(peerId)
      return decodeGroupChannel(data.group)
    } else {
      const data = await this.internal.getUserProfile(peerId)
      return decodePrivateChannel(data, channelId)
    }
  }

  async getChannelList(guildId: string, next?: string) {
    return { data: [await this.getChannel(guildId)] }
  }

  async updateChannel(channelId: string, data: Partial<Universal.Channel>) {
    if (isNonNullable(data.name)) {
      const [scene, peerId] = getSceneAndPeerId(channelId)
      if (scene === 'group') {
        await this.internal.setGroupName(peerId, data.name)
      }
    }
  }

  async muteChannel(channelId: string, guildId?: string, enable?: boolean) {
    const [scene, peerId] = getSceneAndPeerId(channelId)
    if (scene === 'group') {
      await this.internal.setGroupWholeMute(peerId, enable)
    }
  }

  async createDirectChannel(userId: string) {
    return { id: `private:${userId}`, type: Universal.Channel.Type.DIRECT }
  }

  async getFriendList(next?: string) {
    const data = await this.internal.getFriendList()
    return { data: data.friends.map(decodeFriend) }
  }

  async deleteFriend(userId: string) {
    await this.internal.deleteFriend(+userId)
  }

  async handleFriendRequest(messageId: string, approve: boolean, comment?: string) {
    const [initiatorUid, isFiltered] = messageId.split('|')
    if (approve) {
      await this.internal.acceptFriendRequest(initiatorUid, Boolean(+isFiltered))
    } else {
      await this.internal.rejectFriendRequest(initiatorUid, Boolean(+isFiltered), comment)
    }
  }

  async getGuild(guildId: string) {
    const data = await this.internal.getGroupInfo(+guildId)
    return decodeGuild(data.group)
  }

  async getGuildList(next?: string) {
    const data = await this.internal.getGroupList()
    return { data: data.groups.map(decodeGuild) }
  }

  async handleGuildRequest(messageId: string, approve: boolean, comment?: string) {
    const [groupId, invitationSeq] = messageId.split('|')
    if (approve) {
      await this.internal.acceptGroupInvitation(+groupId, +invitationSeq)
    } else {
      await this.internal.rejectGroupInvitation(+groupId, +invitationSeq)
    }
  }

  async getGuildMember(guildId: string, userId: string) {
    const data = await this.internal.getGroupMemberInfo(+guildId, +userId)
    return decodeGuildMember(data.member)
  }

  async getGuildMemberList(guildId: string, next?: string) {
    const data = await this.internal.getGroupMemberList(+guildId)
    return { data: data.members.map(decodeGuildMember) }
  }

  async kickGuildMember(guildId: string, userId: string, permanent?: boolean) {
    await this.internal.kickGroupMember(+guildId, +userId, permanent)
  }

  async muteGuildMember(guildId: string, userId: string, duration: number, reason?: string) {
    await this.internal.setGroupMemberMute(+guildId, +userId, Math.round(duration / 1000))
  }

  async handleGuildMemberRequest(messageId: string, approve: boolean, comment?: string) {
    const [notificationSeq, notificationType, groupId, isFiltered] = messageId.split('|')
    if (approve) {
      await this.internal.acceptGroupRequest(+notificationSeq, notificationType as 'join_request' | 'invited_join_request', +groupId, Boolean(+isFiltered))
    } else {
      await this.internal.rejectGroupRequest(+notificationSeq, notificationType as 'join_request' | 'invited_join_request', +groupId, Boolean(+isFiltered), comment)
    }
  }

  async getLogin() {
    const data = await this.internal.getLoginInfo()
    this.user = decodeLoginUser(data)
    return this.toJSON()
  }

  async getMessage(channelId: string, messageId: string) {
    const [scene, peerId] = getSceneAndPeerId(channelId)
    const data = await this.internal.getMessage(scene, peerId, +messageId)
    const message = await decodeMessage(this, data.message)
    if (!message) throw new Error('Message not found.')
    return message
  }

  async deleteMessage(channelId: string, messageId: string) {
    const [scene, peerId] = getSceneAndPeerId(channelId)
    if (scene === 'group') {
      await this.internal.recallGroupMessage(peerId, +messageId)
    } else {
      await this.internal.recallPrivateMessage(peerId, +messageId)
    }
  }

  async getMessageList(channelId: string, next?: string, direction: Direction = 'before', limit?: number, order?: Order) {
    if (direction !== 'before') throw new Error('Unsupported direction.')
    const [scene, peerId] = getSceneAndPeerId(channelId)
    const { messages, next_message_seq } = await this.internal.getHistoryMessages(scene, peerId, next && +next, limit)
    // 从旧到新
    return { data: filterNullable(await Promise.all(messages.map(item => decodeMessage(this, item)))), next: String(next_message_seq) }
  }

  async createReaction(channelId: string, messageId: string, emojiId: string) {
    const [scene, peerId] = getSceneAndPeerId(channelId)
    if (scene === 'group') {
      const [reactionType, reaction] = emojiId.split('|')
      await this.internal.sendGroupMessageReaction(peerId, +messageId, reaction, reactionType as 'face' | 'emoji')
    }
  }

  async deleteReaction(channelId: string, messageId: string, emojiId: string, userId?: string) {
    const [scene, peerId] = getSceneAndPeerId(channelId)
    if (scene === 'group') {
      const [reactionType, reaction] = emojiId.split('|')
      await this.internal.sendGroupMessageReaction(peerId, +messageId, reaction, reactionType as 'face' | 'emoji', false)
    }
  }

  async getUser(userId: string, guildId?: string) {
    const data = await this.internal.getUserProfile(+userId)
    return decodeUser(data, userId)
  }
}

export namespace MilkyBot {
  export interface Config extends HTTP.Config, WsClient.Options {
    token?: string
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      token: Schema.string().description('API 访问令牌。').role('secret')
    }),
    HTTP.createConfig('http://127.0.0.1:3000'),
    WsClient.Options
  ])
}
