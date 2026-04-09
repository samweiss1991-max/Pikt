import { Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'
import ProtectedRoute from './components/ProtectedRoute'
import { ViewModeProvider } from './context/ViewModeContext'
import { SearchProvider } from './context/SearchContext'
import Dashboard from './pages/Dashboard'
import Discovery from './pages/Discovery'
import Marketplace from './pages/Marketplace'
import CandidateProfile from './pages/CandidateProfile'
import Shortlist from './pages/Shortlist'
import Saved from './pages/Saved'
import MyCandidates from './pages/MyCandidates'
import Placements from './pages/Placements'
import Earnings from './pages/Earnings'
import Integrations from './pages/Integrations'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute><ViewModeProvider><SearchProvider><Shell /></SearchProvider></ViewModeProvider></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="marketplace" element={<Discovery />} />
        <Route path="marketplace/results" element={<Marketplace />} />
        <Route path="candidates/:id" element={<CandidateProfile />} />
        <Route path="shortlist" element={<Shortlist />} />
        <Route path="saved" element={<Saved />} />
        <Route path="my-candidates" element={<MyCandidates />} />
        <Route path="placements" element={<Placements />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="integrations" element={<Integrations />} />
      </Route>
    </Routes>
  )
}
