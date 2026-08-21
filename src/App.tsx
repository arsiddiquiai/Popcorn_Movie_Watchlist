import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import CinemaBridge from './routes/CinemaBridge'
import PickForMe from './routes/PickForMe'
import Search from './routes/Search'
import Settings from './routes/Settings'
import TasteDNA from './routes/TasteDNA'
import Watchlist from './routes/Watchlist'
import { ThemeProvider } from './theme/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Watchlist />} />
            <Route path="/search" element={<Search />} />
            <Route path="/bridge" element={<CinemaBridge />} />
            <Route path="/pick" element={<PickForMe />} />
            <Route path="/taste" element={<TasteDNA />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
