import { useSearchParams } from 'react-router-dom'
import { RoutePlaceholder } from './RoutePlaceholder'

export function Dev() {
  const [searchParams] = useSearchParams()

  if (!searchParams.has('debug')) {
    return (
      <RoutePlaceholder
        title="Dev tools"
        description="Add ?debug to the URL to enable this page."
      />
    )
  }

  return (
    <RoutePlaceholder
      title="Dev tools"
      description="Waveform, pitch, RMS, and note-event plots against a mic or uploaded WAV land here in Phase 2."
    />
  )
}
