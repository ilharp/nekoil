import type { MouseEvent, ReactNode } from 'react';
import styles from './index.module.scss';

const handleOpenChannel = (e: MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  window.Telegram.WebApp.openTelegramLink('https://t.me/nekoil')
}

export const Footer = ({ children }: { children?: ReactNode }) => (
  <div>
    <div className={styles.container}>
      {children}
      {__DEFINE_NEKOIL_ENV__ !== 'production' && (
        <p>{__DEFINE_NEKOIL_ENV__}环境</p>
      )}
      {import.meta.env.MODE === 'development' && <p>开发模式</p>}
      <p>Nekoil {__DEFINE_NEKOIL_VERSION_STRING__}</p>
      <p>
        在{' '}
        <a
          href="https://t.me/nekoil"
          target="_blank"
          rel="noreferrer noopener"
          onClick={handleOpenChannel}
        >
          Nekoil
        </a>{' '}
        频道获得使用说明和更新通知
      </p>
      <p>
        <a
          href="https://github.com/ilharp/nekoil"
          target="_blank"
          rel="noreferrer noopener"
        >
          开放源代码
        </a>
      </p>
    </div>
  </div>
)
