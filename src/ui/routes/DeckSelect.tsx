import { Link } from 'react-router-dom'
import styles from './DeckSelect.module.css'

export function DeckSelect() {
  return (
    <section>
      <h1>Choose a deck</h1>
      <ul className={styles.list}>
        <li>
          <Link to="/decks/note-finder">Note finder</Link>
        </li>
        <li>
          <Link to="/decks/scale-positions">Major scale positions</Link>
        </li>
      </ul>
    </section>
  )
}
