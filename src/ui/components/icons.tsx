import type { SVGProps } from 'react'
import styles from './icons.module.css'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function GuitarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M17 4 H29" />
      <path d="M23 4 V18" />
      <path d="M23 18 C 37 18 39 30 34 38 C 29 45 17 45 12 38 C 7 30 9 18 23 18 Z" />
      <circle className={styles.pop} cx="22" cy="30" r="3.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ComingSoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="24" r="3" fill="currentColor" stroke="none" />
      <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none" />
      <circle cx="36" cy="24" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function NoteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M30 8 V31" />
      <path d="M30 8 L40 11.5 V19.5 L30 16" />
      <circle className={styles.pop} cx="24" cy="34" r="6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FretboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 13 H42 M6 20 H42 M6 27 H42 M6 34 H42" />
      <path d="M15 8 V39 M25 8 V39 M35 8 V39" />
      <circle className={styles.pop} cx="25" cy="20" r="2.6" fill="currentColor" stroke="none" />
      <circle className={styles.pop} cx="35" cy="27" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TunerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 40 A 12 12 0 0 1 36 40" />
      <path d="M24 40 V22" />
      <circle className={styles.pop} cx="24" cy="40" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
