import { Avatar, AvatarFallback, AvatarImage } from '@sym-app/components'
import type { NekoilSatoriUser } from 'nekoil-typedef'
import { useCallback, useMemo, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'

export const AioAvatar = ({ user }: { user: NekoilSatoriUser }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const thumbhashUrl = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      user.nekoil?.avatar_thumbhash
        ? thumbHashToDataURL(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            Uint8Array.from(atob(user.nekoil?.avatar_thumbhash), (c) =>
              c.charCodeAt(0),
            ),
          )
        : undefined,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    [user.nekoil?.avatar_thumbhash],
  )

  const handleImgLoad = useCallback(() => {
    setLoading(false)
  }, [])

  const handleImgError = useCallback(() => {
    setError(true)
  }, [])

  return (
    <Avatar className="sym-aio-avatar">
      {!error && loading && thumbhashUrl && (
        <AvatarImage src={thumbhashUrl} alt={user.name} />
      )}
      {!error && (
        <AvatarImage
          src={`https://api.390721.xyz/nekoil/v0/proxy/${user.avatar}`}
          alt={user.name}
          onLoad={handleImgLoad}
          onError={handleImgError}
        />
      )}
      <AvatarFallback>{user.name?.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}
