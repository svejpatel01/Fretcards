import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './ui/AppLayout'
import { InstrumentSelect } from './ui/routes/InstrumentSelect'
import { DeckSelect } from './ui/routes/DeckSelect'
import { NoteDeck } from './ui/routes/NoteDeck'
import { ScaleDeck } from './ui/routes/ScaleDeck'
import { Tuner } from './ui/routes/Tuner'
import { Settings } from './ui/routes/Settings'
import { HowItWorks } from './ui/routes/HowItWorks'
import { Dev } from './ui/routes/Dev'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<InstrumentSelect />} />
          <Route path="decks" element={<DeckSelect />} />
          <Route path="decks/note-finder" element={<NoteDeck />} />
          <Route path="decks/scale-positions" element={<ScaleDeck />} />
          <Route path="tuner" element={<Tuner />} />
          <Route path="settings" element={<Settings />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="dev" element={<Dev />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
