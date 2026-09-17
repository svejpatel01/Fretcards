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

      <div className={styles.head}>
        <h2>Instruments</h2>
        <span className="eyebrow">Pick one to start</span>
      </div>

      <nav className={styles.grid} aria-label="Instruments">
        {INSTRUMENTS.map((instrument, i) => (
          <Link
            key={instrument.id}
            to="/decks"
            className={`tile ${styles.card} ${i % 2 ? styles.cardCyan : styles.cardPink}`}
          >
            <div className={styles.cardTop}>
              <span className={styles.no}>
                <GuitarIcon />
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <div className={styles.cardBody}>
              <h3>{instrument.name}</h3>
              <span className={styles.badge}>Ready to play</span>
            </div>
            <div className={styles.dots} aria-hidden="true" />
          </Link>
        ))}
        {COMING_LATER.map((name) => (
          <div key={name} className={`tile tile--soon ${styles.soon}`}>
            <ComingSoonIcon />
            <span className={styles.soonTitle}>{name}</span>
            <span className={styles.soonTag}>Coming later</span>
          </div>
        ))}
      </nav>
    </section>
  )
}
