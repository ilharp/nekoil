import type h from '@satorijs/element'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { requestBlobV1 } from '../../../utils'
import styles from './index.module.scss'

export const FRImg = ({ elem }: { elem: h }) => {
  const thumbhashUrl = useMemo(
    () =>
      thumbHashToDataURL(
        Uint8Array.from(atob(elem.attrs['nekoil:thumbhash'] as string), (c) =>
          c.charCodeAt(0),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elem.attrs['nekoil:thumbhash']],
  )

  const { isSuccess, data } = useQuery({
    queryKey: ['nia', elem.attrs.src],
    queryFn: requestBlobV1(`/nekoil/v0/proxy/${elem.attrs.src}`),
  })

  return (
    <div className={styles.container}>
      <img
        className={styles.img}
        src={isSuccess ? data : thumbhashUrl}
        width={`${elem.attrs.width}px`}
      />
    </div>
  )
}
