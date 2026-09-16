import { Link } from 'react-router-dom'
import styles from './InstrumentSelect.module.css'

export function InstrumentSelect() {
  return (
    <section>
      <h1>Choose an instrument</h1>
      <ul className={styles.list}>
        <li>
          <Link to="/decks">Acoustic guitar</Link>
        </li>
        <li className={styles.comingLater}>Electric guitar (coming later)</li>
        <li className={styles.comingLater}>Bass (coming later)</li>
        <li className={styles.comingLater}>Ukulele (coming later)</li>
      </ul>
    </section>
  )
}
