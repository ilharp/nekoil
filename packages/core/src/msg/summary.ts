import type h from '@satorijs/element'

type DisplayComponent = string

// const prepare = async () => {}

const render = async (elements: h[]): Promise<DisplayComponent[] | false> => {
  if (!elements.length) return ['空消息']
  const result = await Promise.all(elements.map(visit))
  if (result.every((x) => x === false)) return false
  return result.flatMap((x) => (x === false ? ['[不支持的消息]'] : x))
}

// export const send = async (
//   content: string | null | undefined,
// ): Promise<DisplayComponent[]> => {
//   if (!content) return ['空消息']
//   // await prepare()
//   const elements = h.normalize(content)
//   let result = await render(elements)
//   if (result === false) result = ['[不支持的消息]']
//   return result
// }

export const summaryMessagerSend = async (
  elements: h[],
): Promise<DisplayComponent[]> => {
  let result = await render(elements)
  if (result === false) result = ['[不支持的消息]']
  return result
}

const visit = async (element: h): Promise<DisplayComponent[] | false> => {
  const { type, attrs, children } = element

  switch (type) {
    case 'text':
      return [attrs['content'] as string]

    case 'img': {
      return ['[图片]']
    }

    case 'audio': {
      return ['[语音]']
    }

    case 'video':
      return ['[视频]']

    case 'file':
      return ['[文件]']

    case 'at':
      return [`@${attrs['name'] as string}`]

    case 'quote':
      return ['[回复] ']

    case 'message': {
      if ('forward' in attrs) {
        if ('id' in attrs) {
          return ['[消息]']
        } else if (children.every((x) => 'id' in x)) {
          return ['[聊天记录]'] // 普通合并转发
        } else {
          return ['[聊天记录]'] // 伪造合并转发
        }
      } else {
        // 普通切割消息
        const result = await render(children)
        if (result) return ['[消息]', ...result]
        else return ['[消息]']
      }
    }

    default: {
      // 兜底
      return await render(children)
    }
  }
}
