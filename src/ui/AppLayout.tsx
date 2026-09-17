import { Link, Outlet, useSearchParams } from 'react-router-dom'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const [searchParams] = useSearchParams()
  const debug = searchParams.has('debug')

  return (
    <div>
      <div className="glow glow--pink" aria-hidden="true" />
      <div className="glow glow--cyan" aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Fretcards
        </Link>
        <nav className={styles.nav}>
          <Link to="/tuner">Tuner</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/settings">Settings</Link>
          {debug && <Link to="/dev?debug">Dev</Link>}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
