import { Link } from 'react-router-dom'
import { NoteIcon, FretboardIcon } from '../components/icons'
import styles from './DeckSelect.module.css'

export function DeckSelect() {
  return (
    <section>
      <h1 className="mark">Choose a deck</h1>

      <h2 className="eyebrow">Acoustic guitar</h2>
      <nav className={styles.grid} aria-label="Decks">
        <Link to="/decks/note-finder" className={`tile ${styles.tile}`}>
          <span className={styles.no}>001</span>
          <span className={styles.ico}>
            <NoteIcon />
          </span>
          <span className={styles.meta}>
            <span className={styles.title}>Note finder</span>
            <span className={styles.tag}>
              Play the note shown on the card, anywhere on the neck
            </span>
          </span>
        </Link>

        <Link to="/decks/scale-positions" className={`tile ${styles.tile}`}>
          <span className={styles.no}>002</span>
          <span className={styles.ico}>
            <FretboardIcon />
          </span>
          <span className={styles.meta}>
            <span className={styles.title}>Major scale positions</span>
            <span className={styles.tag}>Play a scale shape up and back down, graded live</span>
          </span>
        </Link>
      </nav>
    </section>
  )
}
