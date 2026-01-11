import type { ContentPackWithFull } from './cp'

export interface CpimgrPayload {
  cpssrUrl: string
  cpwfData: ContentPackWithFull
  proxyToken: string
  internalToken: string
  selfUrlInternal: string
  showMoreTip: boolean
  largePreview?: boolean
}
