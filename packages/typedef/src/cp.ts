import type { DatabaseBase } from './common'
import type { NekoilSatoriMessage } from './satori'

export interface ContentPackV1 extends DatabaseBase {
  cpid: number

  cp_version: number

  creator: number

  owner: number

  /**
   * 1=zstdv1 2=jsonv1
   */
  data_full_mode: number

  data_full: string

  data_summary: string

  /**
   * 1=manual 2=tg 3=qq
   */
  platform: number

  cpssr_version: number

  /**
   * purge 后为 null
   */
  cpssr_niaid: number | null
}

export interface ContentPackHandleV1 extends DatabaseBase {
  handle_id: number

  /**
   * 1=unlisted(_) 2=public 3=resid 4=private(_)
   */
  handle_type: number

  handle: string

  cpid: number
}

export interface ContentPackSummary {
  count: number
  title: string
  summary: string[]
  largePreview?: boolean
}

export interface ContentPackWithSummary extends ContentPackV1 {
  summary: ContentPackSummary
}

export interface ContentPackFull {
  messages: NekoilSatoriMessage[]
}

export interface ContentPackWithFull extends ContentPackWithSummary {
  full: ContentPackFull
}

export interface CpHandleDeletedV1 {
  id: number

  handle_id: number

  /**
   * 1=unlisted(_) 2=public 3=resid 4=private(_)
   */
  handle_type: number

  handle: string

  cpid: number

  created_time: Date

  deleted_time: Date

  /**
   * 1=admin 2=user 3=TTL(过期)
   */
  deleted_reason: number
}

export interface NekoilCpCpGetRequest {
  query: string
}

export interface NekoilCpCpDelRequest {
  query: string
}

export type ContentPackWithAll = ContentPackWithSummary & ContentPackWithFull
