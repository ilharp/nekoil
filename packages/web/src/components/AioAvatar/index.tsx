import { Avatar, AvatarFallback, AvatarImage } from '@sym-app/components'
import { useQuery } from '@tanstack/react-query'
import type { NekoilSatoriUser } from 'nekoil-typedef'
import { useMemo } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { requestBlobV1 } from '../../utils'

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
    queryFn: (qfc) =>
      user.avatar
        ? requestBlobV1(`/nekoil/v0/proxy/${user.avatar}`)(qfc)
        : // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          Promise.reject<string>(),
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
