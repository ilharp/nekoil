export interface NiAssetsV1 {
  niaid: number

  /**
   * 1=pic
   */
  type: number

  /**
   * sha256 url safe base64, static 44bytes
   */
  handle: string

  /**
   * bytes, hard max 4G, soft max 64M
   */
  size: number

  filename: string

  mime: string

  /**
   * base64
   */
  thumbhash: string

  width: number
  height: number

  tg_file_id: string
}

export interface NiAssetsRcV1 {
  id: number

  niaid: number

  /**
   * 1=cp, 2=cpssr
   */
  ref_type: number

  ref: number
}
