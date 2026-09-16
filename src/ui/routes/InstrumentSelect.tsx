import { Link } from 'react-router-dom'
import { INSTRUMENTS } from '../../core/instruments/registry'
import { GuitarIcon, ComingSoonIcon } from '../components/icons'
import styles from './InstrumentSelect.module.css'

// v1 only enables acoustic guitar (see registry.ts); these are listed for context, not linked.
const COMING_LATER = ['Electric guitar', 'Bass', 'Ukulele']

export function InstrumentSelect() {
  return (
    <section>
      <h1 className="mark">Choose an instrument</h1>
      <p className={styles.intro}>
        Flashcards that listen through your mic and grade what you play.
      </p>

      <h2 className="eyebrow">Instruments</h2>
      <nav className={styles.grid} aria-label="Instruments">
        {INSTRUMENTS.map((instrument, i) => (
          <Link key={instrument.id} to="/decks" className={`tile ${styles.tile}`}>
            <span className={styles.no}>{String(i + 1).padStart(3, '0')}</span>
            <span className={styles.ico}>
              <GuitarIcon />
            </span>
            <span className={styles.title}>{instrument.name}</span>
          </Link>
        ))}
        {COMING_LATER.map((name) => (
          <div key={name} className={`tile tile--soon ${styles.tile}`}>
            <span className={styles.ico}>
              <ComingSoonIcon />
            </span>
            <span className={styles.title}>{name}</span>
            <span className={styles.tag}>Coming later</span>
          </div>
        ))}
      </nav>
    </section>
  )
}
