import type { SymAioHost, SymMsgGroupCtx } from '@sym-app/components'
import { SymAioHostContext, SymMsgGroupContext } from '@sym-app/components'
import { useEffect, useRef } from 'react'
import styles from './index.module.scss'

export const ContentPackSplash = () => {
  const spinner = useRef<HTMLElement | null>(null)

  useEffect(() => {
    spinner.current!.animate(
      [
        {},
        {
          opacity: 1,
          offset: 0.1,
        },
        {
          width: 0,
          height: 0,
          opacity: 0,
        },
      ],
      {
        delay: 500,
        duration: 800,
        fill: 'forwards',
        easing: 'cubic-bezier(.6,0,1,.2)',
      },
    )
  }, [])

  return (
    <>
      <div className={styles.animContainer}>
        <div className="spinner-container">
          <i ref={spinner} className="spinner" />
        </div>
      </div>
      <div className={styles.animContainer}>
        <SymAioHostContext value={symAioHost}>
          <SymMsgGroupContext value={symMsgGroupCtx}></SymMsgGroupContext>
        </SymAioHostContext>
      </div>
    </>
  )
}

const symAioHost: SymAioHost = {
  frCanRemoveBubble: () => false,
  frRenderers: {},
}

const symMsgGroupCtx: SymMsgGroupCtx = {
  group: true,
}
