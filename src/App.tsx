import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth/AuthGate'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedLayout } from './auth/ProtectedLayout'
import Assistant from './routes/Assistant'
import CinemaBridge from './routes/CinemaBridge'
import ComingSoon from './routes/ComingSoon'
import Feedback from './routes/Feedback'
import { Privacy, Terms } from './routes/Legal'
import MovieDetail from './routes/MovieDetail'
import PickForMe from './routes/PickForMe'
import ResetPassword from './routes/ResetPassword'
import Search from './routes/Search'
import Settings from './routes/Settings'
import TasteDNA from './routes/TasteDNA'
import Watchlist from './routes/Watchlist'
import { ThemeProvider } from './theme/ThemeProvider'

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthGate />} />
            {/* Deliberately outside both AuthGate and ProtectedLayout: the
                recovery link establishes a real session, so AuthGate would
                redirect it away to "/" before the user could set a new
                password, and ProtectedLayout would require being logged in
                a different way to even reach it. */}
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Watchlist />} />
              <Route path="/search" element={<Search />} />
              <Route path="/movie/:tmdbId" element={<MovieDetail />} />
              <Route path="/bridge" element={<CinemaBridge />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/pick" element={<PickForMe />} />
              <Route path="/taste" element={<TasteDNA />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/settings" element={<Settings />} />
              {/* Unmatched paths land here. ProtectedLayout (the parent
                  route) runs its auth check first, so a logged-out visit
                  to an unknown path — e.g. /watchlist — still redirects to
                  /auth rather than rendering nothing. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
