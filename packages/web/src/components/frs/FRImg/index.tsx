import type h from '@satorijs/element'
import { useCallback, useMemo, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { getPlaceholderUrl } from '../../../utils'

import styles from './index.module.scss'

export const FRImg = ({ elem }: { elem: h }) => {
  const width = Number(elem.attrs.width)
  const height = Number(elem.attrs.height)

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

  const [loading, setLoading] = useState(true)

  const handleImgLoad = useCallback(() => {
    setLoading(false)
  }, [])

  const placeholderUrl = useMemo(
    () => getPlaceholderUrl(width, height),
    [width, height],
  )

  return (
    <div className={styles.container}>
      <img className={styles.imgPlaceholder} src={placeholderUrl} />
      {loading && <img className={styles.img} src={thumbhashUrl} />}
      <img
        className={styles.img}
        src={`https://api.390721.xyz/nekoil/v0/proxy/${elem.attrs.src}`}
        onLoad={handleImgLoad}
      />
    </div>
  )
}
