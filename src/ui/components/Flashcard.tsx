import styles from './Flashcard.module.css'

export interface FlashcardProps {
  label: string
}

export function Flashcard({ label }: FlashcardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.label} data-testid="flashcard-label">
        {label}
      </span>
    </div>
  )
}
