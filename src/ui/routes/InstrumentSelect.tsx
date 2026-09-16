import { Link } from 'react-router-dom'
import { INSTRUMENTS } from '../../core/instruments/registry'
import styles from './InstrumentSelect.module.css'

// v1 only enables acoustic guitar (see registry.ts); these are listed for context, not linked.
const COMING_LATER = ['Electric guitar', 'Bass', 'Ukulele']

export function InstrumentSelect() {
  return (
    <section>
      <h1>Choose an instrument</h1>
      <ul className={styles.list}>
        {INSTRUMENTS.map((instrument) => (
          <li key={instrument.id}>
            <Link to="/decks">{instrument.name}</Link>
          </li>
        ))}
        {COMING_LATER.map((name) => (
          <li key={name} className={styles.comingLater}>
            {name} (coming later)
          </li>
        ))}
      </ul>
    </section>
  )
}
