import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth/AuthGate'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedLayout } from './auth/ProtectedLayout'
import AccountDeleted from './routes/AccountDeleted'
import Assistant from './routes/Assistant'
import CinemaBridge from './routes/CinemaBridge'
import ComingSoon from './routes/ComingSoon'
import DuoInvite from './routes/DuoInvite'
import DuoSession from './routes/DuoSession'
import Feedback from './routes/Feedback'
import { Privacy, Terms } from './routes/Legal'
import MovieDetail from './routes/MovieDetail'
import PickForMe from './routes/PickForMe'
import PublicShare from './routes/PublicShare'
import ResetPassword from './routes/ResetPassword'
import Search from './routes/Search'
import Settings from './routes/Settings'
import TasteDNA from './routes/TasteDNA'
import TvDetail from './routes/TvDetail'
import TvWatchlist from './routes/TvWatchlist'
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
            {/* Deliberately outside ProtectedLayout: by the time this is
                reached, the account no longer exists — there is no session
                left to guard. */}
            <Route path="/account-deleted" element={<AccountDeleted />} />
            {/* Deliberately outside ProtectedLayout — this is the whole
                point of a public share link: an anonymous visitor with no
                session at all needs to be able to see it. A logged-in
                visitor can view it too; nothing here depends on auth
                state. */}
            <Route path="/w/:token" element={<PublicShare />} />
            {/* Deliberately outside ProtectedLayout, same as /w/:token —
                but unlike that route, there is nothing to actually show an
                unauthenticated visitor here (no anon grants exist on
                duo_sessions/duo_votes at all). This page's only job for a
                logged-out visitor is sending them to sign in/up first. */}
            <Route path="/duo/:token" element={<DuoInvite />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Watchlist />} />
              <Route path="/search" element={<Search />} />
              <Route path="/movie/:tmdbId" element={<MovieDetail />} />
              <Route path="/tv/:tmdbId" element={<TvDetail />} />
              <Route path="/tv" element={<TvWatchlist />} />
              <Route path="/bridge" element={<CinemaBridge />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/pick" element={<PickForMe />} />
              <Route path="/duo/session/:sessionId" element={<DuoSession />} />
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
