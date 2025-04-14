import type { Message } from '@satorijs/protocol'

export interface NekoilCpCpGetRequest {}

export interface NekoilCpCpGetResponse {
  title: string
  summary: string[]
  messages: Message[]
}
