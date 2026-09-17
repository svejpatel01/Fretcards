import { Link } from 'react-router-dom'
import { NoteIcon, FretboardIcon } from '../components/icons'
import styles from './DeckSelect.module.css'

export function DeckSelect() {
  return (
    <section>
      <h1 className="mark">Choose a deck</h1>

      <div className={styles.head}>
        <h2>Acoustic guitar</h2>
        <span className="eyebrow">Two decks &middot; pick one</span>
      </div>

      <nav className={styles.grid} aria-label="Decks">
        <Link to="/decks/note-finder" className={`tile ${styles.card} ${styles.cardPink}`}>
          <div className={styles.cardTop}>
            <span className={styles.no}>
              <NoteIcon />
              01
            </span>
          </div>
          <div className={styles.cardBody}>
            <h3>Note finder</h3>
            <span className={styles.badge}>Anywhere on the neck</span>
          </div>
          <p className={styles.desc}>Play the note shown on the card, anywhere on the neck.</p>
          <div className={styles.dots} aria-hidden="true" />
        </Link>

        <Link to="/decks/scale-positions" className={`tile ${styles.card} ${styles.cardCyan}`}>
          <div className={styles.cardTop}>
            <span className={styles.no}>
              <FretboardIcon />
              02
            </span>
          </div>
          <div className={styles.cardBody}>
            <h3>Major scale positions</h3>
            <span className={styles.badge}>Graded live</span>
          </div>
          <p className={styles.desc}>Play a scale shape up and back down, graded as you go.</p>
          <div className={styles.dots} aria-hidden="true" />
        </Link>
      </nav>
    </section>
  )
}
