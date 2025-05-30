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

  const imgContainerStyle = useMemo(
    () => ({
      paddingTop: `calc(${elem.attrs.width}/${elem.attrs.height}*100%)`,
    }),
    [elem.attrs.height, elem.attrs.width],
  )

  return (
    <div className={styles.container}>
      <div style={imgContainerStyle}>
        <img
          className={styles.img}
          src={`https://api.390721.xyz/nekoil/v0/proxy/${elem.attrs.src}`}
          onLoad={handleOnLoad}
        />
        {loading && <img className={styles.img} src={thumbhashUrl} />}
      </div>
    </div>
  )
}
