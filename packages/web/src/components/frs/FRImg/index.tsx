import type h from '@satorijs/element'
import { useEffect, useMemo, useRef } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
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

  const imgElement = useRef(null as unknown as HTMLImageElement)

  useEffect(() => {
    const imgOriginalLoader = new Image()
    imgOriginalLoader.onload = () => {
      imgElement.current.src = imgOriginalLoader.src
    }
    imgOriginalLoader.src = `https://api.390721.xyz/nekoil/v0/proxy/${elem.attrs.src}`
  }, [elem.attrs.src])

  return (
    <div className={styles.container}>
      <img
        className={styles.img}
        ref={imgElement}
        src={thumbhashUrl}
        width={`${elem.attrs.width}px`}
      />
    </div>
  )
}
