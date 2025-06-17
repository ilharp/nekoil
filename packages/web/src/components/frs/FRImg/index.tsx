import type h from '@satorijs/element'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { requestProxyV1 } from '../../../utils/request'
import styles from './index.module.scss'

export const FRImg = ({ elem }: { elem: h }) => {
  const thumbhashUrl = useMemo(
    () =>
      elem.attrs['nekoil:thumbhash']
        ? thumbHashToDataURL(
            Uint8Array.from(
              atob(elem.attrs['nekoil:thumbhash'] as string),
              (c) => c.charCodeAt(0),
            ),
          )
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elem.attrs['nekoil:thumbhash']],
  )

  const { isSuccess, data } = useQuery({
    queryKey: ['nia', elem.attrs.src],
    queryFn: requestProxyV1(elem.attrs.src as string),
  })

  return isSuccess || thumbhashUrl ? (
    <div className={styles.container}>
      <img
        className={styles.img}
        src={isSuccess ? data : thumbhashUrl}
        width={`${elem.attrs.width}px`}
      />
    </div>
  ) : (
    '[图片]'
  )
}
