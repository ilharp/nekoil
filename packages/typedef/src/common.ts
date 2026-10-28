export interface NekoilResponseBody<T> {
  code: number
  data?: T | undefined
  msg?: string | undefined
}

export interface DatabaseBase {
  created_time: Date

  deleted: number

  deleted_time: Date

  /**
   * 1=admin 2=user 3=TTL(过期)
   */
  deleted_reason: number
}
