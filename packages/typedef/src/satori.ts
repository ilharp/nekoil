import type { Message, User } from '@satorijs/protocol'

export interface NekoilSatoriUserExt {
  avatar_origins: string[]
  avatar_width: number
  avatar_height: number
  avatar_thumbhash: string
}

export interface NekoilSatoriUser extends User {
  nekoil: NekoilSatoriUserExt
}

export interface NekoilSatoriMessage extends Message {
  user: NekoilSatoriUser
}
