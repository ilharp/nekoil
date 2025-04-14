export interface NekoilResponseBody<T> {
  code: number
  data?: T | undefined
  msg?: string | undefined
}
