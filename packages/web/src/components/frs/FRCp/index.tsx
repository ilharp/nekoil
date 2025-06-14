import type h from '@satorijs/element'
import { Link } from 'react-router'
import styles from './index.module.scss'

export const FRCp = ({ elem }: { elem: h }) => {
  const summaryList = elem.children.find(
    (x) => x.type === 'nekoil:cpsummarylist',
  )

  return (
    <Link
      to={`/${encodeURIComponent(elem.attrs['handle'])}`}
      className={styles.outerContainer}
    >
      <div className={styles.innerContainer}>
        <div className={styles.title}>{elem.attrs['title']}</div>
        {summaryList && (
          <div className={styles.contentContainer}>
            {summaryList.children.map((x, i) => (
              <p key={i} className={styles.contentText}>
                {x.attrs['content']}
              </p>
            ))}
          </div>
        )}
        <div className={styles.footer}>
          查看 {elem.attrs['count']} 条聊天记录
        </div>
      </div>
    </Link>
  )
}
