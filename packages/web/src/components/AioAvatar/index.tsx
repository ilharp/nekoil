import { Avatar, AvatarFallback, AvatarImage } from '@sym-app/components'
import { useQuery } from '@tanstack/react-query'
import type { NekoilSatoriUser } from 'nekoil-typedef'
import { useMemo } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { requestProxyV1 } from '../../utils/request'

export const AioAvatar = ({ user }: { user: NekoilSatoriUser }) => {
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

  const { isSuccess, data } = useQuery({
    queryKey: ['nia', user.avatar],
    queryFn: requestProxyV1(user.avatar),
  })

  return (
    <Avatar className="sym-aio-avatar">
      {Boolean(isSuccess ? data : thumbhashUrl) && (
        <AvatarImage src={isSuccess ? data : thumbhashUrl} alt={user.name} />
      )}
      <AvatarFallback>{user.name?.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}
