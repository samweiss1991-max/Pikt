import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'
import ProtectedRoute from './components/ProtectedRoute'
import { ViewModeProvider } from './context/ViewModeContext'
import { SearchProvider } from './context/SearchContext'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const CandidateProfile = lazy(() => import('./pages/CandidateProfile'))
const Shortlist = lazy(() => import('./pages/Shortlist'))
const MyCandidates = lazy(() => import('./pages/MyCandidates'))
const Placements = lazy(() => import('./pages/Placements'))
const Earnings = lazy(() => import('./pages/Earnings'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Refer = lazy(() => import('./pages/Refer'))
const Login = lazy(() => import('./pages/auth/Login'))
const Signup = lazy(() => import('./pages/auth/Signup'))

export default function App() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading…</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute><ViewModeProvider><SearchProvider><Shell /></SearchProvider></ViewModeProvider></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="candidates/:id" element={<CandidateProfile />} />
        <Route path="shortlist" element={<Shortlist />} />
        <Route path="my-candidates" element={<MyCandidates />} />
        <Route path="placements" element={<Placements />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="refer" element={<Refer />} />
        <Route path="integrations" element={<Integrations />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
