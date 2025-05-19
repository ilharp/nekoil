import type h from '@satorijs/element'
import { useCallback, useMemo, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import styles from './index.module.scss'

export const FRImg = ({ elem }: { elem: h }) => {
  const [loading, setLoading] = useState(true)

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

  const handleOnLoad = useCallback(() => {
    setLoading(false)
  }, [])

  return (
    <div className={styles.container}>
      <img
        className={styles.origin}
        height={`${elem.attrs.height}px`}
        width={`${elem.attrs.width}px`}
        src={`https://api.390721.xyz/nekoil/v0/proxy/${elem.attrs.src}`}
        onLoad={handleOnLoad}
      />
      {loading && (
        <img
          className={styles.thumb}
          height={`${elem.attrs.height}px`}
          width={`${elem.attrs.width}px`}
          src={thumbhashUrl}
        />
      )}
    </div>
  )
}
