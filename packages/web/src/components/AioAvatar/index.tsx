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
    <div className="sym-aio-avatar">
      <img
        src={isSuccess ? data : thumbhashUrl}
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        width={`${user.nekoil?.avatar_width}px`}
      />
    </div>
  )
}
