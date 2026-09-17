interface IconProps {
  className?: string
}

// Thin wrappers around Phosphor Icons (loaded via <link> in index.html, same
// icon set svej.org itself uses) so callers get typed components instead of
// bare class-name strings.
function PhosphorIcon({ name, className }: { name: string; className?: string }) {
  return (
    <i className={`ph-bold ph-${name}${className ? ` ${className}` : ''}`} aria-hidden="true" />
  )
}

export function GuitarIcon(props: IconProps) {
  return <PhosphorIcon name="guitar" {...props} />
}

export function NoteIcon(props: IconProps) {
  return <PhosphorIcon name="music-notes" {...props} />
}

export function FretboardIcon(props: IconProps) {
  return <PhosphorIcon name="grid-four" {...props} />
}

export function TunerIcon(props: IconProps) {
  return <PhosphorIcon name="gauge" {...props} />
}

export function ComingSoonIcon(props: IconProps) {
  return <PhosphorIcon name="dots-three" {...props} />
}
