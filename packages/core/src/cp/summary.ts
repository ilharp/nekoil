import type h from '@satorijs/element'

type DisplayComponent = string

// type FRRenderer = (element: h) => Promise<DisplayComponent[]>
type FRRendererNullable = (element: h) => Promise<DisplayComponent[] | null>

const EMPTY = ['[空消息]']
const UNSUPPORTED = ['[不支持的消息]']

const renderIntl = async (
  elements: h[],
): Promise<DisplayComponent[] | null> => {
  const result = await Promise.all(elements.map(visit))
  if (result.every((x) => x === null)) return null
  return result.flatMap((x) => x ?? UNSUPPORTED)
}

/**
 * @param elements 实际情况下这里应该不会出现 undefined，不过这里做了兼容
 */
export const summaryMessagerSend = async (
  elements: h[] | undefined,
): Promise<DisplayComponent[]> => {
  if (!elements?.length) return EMPTY
  return (await renderIntl(elements)) ?? UNSUPPORTED
}

const visit: FRRendererNullable = async (element) => {
  const { type, attrs, children } = element

  switch (type) {
    case 'text':
      return [attrs['content'] as string]

    case 'nekoil:oversizedimg':
    case 'nekoil:failedimg':
    case 'img': {
      return ['[图片]']
    }

    case 'nekoil:tgsticker': {
      return ['[表情]']
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
        const result = await renderIntl(children)
        if (result) return ['[消息]', ...result]
        else return ['[消息]']
      }
    }

    case 'nekoil:failedfwd':
    case 'nekoil:cp': {
      return ['[聊天记录]']
    }

    default: {
      // 兜底
      return await renderIntl(children)
    }
  }
}
