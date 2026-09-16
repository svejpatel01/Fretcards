import styles from './ResultBanner.module.css'

export interface ResultBannerProps {
  correct: boolean
  message: string
}

/** Correct/wrong feedback. Never signaled by color alone: always paired with an icon and text. */
export function ResultBanner({ correct, message }: ResultBannerProps) {
  return (
    <div
      className={
        correct ? `${styles.banner} ${styles.correct}` : `${styles.banner} ${styles.wrong}`
      }
      role="status"
    >
      <span aria-hidden="true" className={styles.icon}>
        {correct ? '✓' : '✗'}
      </span>
      <span>{message}</span>
    </div>
  )
}
