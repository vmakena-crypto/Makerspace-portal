import { Navigate, Route, Routes } from 'react-router-dom'
import { configured } from './supabaseClient'
import Layout from './components/Layout'
import { RequireAuth, RequireRole } from './components/Guards'
import Login from './pages/Login'
import Home from './pages/Home'
import Profile from './pages/Profile'
import CheckIn from './pages/CheckIn'
import Inside from './pages/staff/Inside'
import QRPage from './pages/staff/QRPage'
import Ideas from './pages/Ideas'
import Requests from './pages/Requests'
import NewRequest from './pages/NewRequest'
import Queue from './pages/staff/Queue'
import Inventory from './pages/staff/Inventory'
import IdeaPool from './pages/staff/IdeaPool'

export default function App() {
  if (!configured) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md rounded-lg border border-red-300 bg-red-50 p-5 text-red-900 space-y-2">
          <h1 className="font-bold">Supabase is not configured</h1>
          <p className="text-sm">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the
            Cloudflare Pages environment variables, then redeploy. See README.md.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/ideas" element={<Ideas />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/new" element={<NewRequest />} />
        <Route
          path="/staff/inside"
          element={
            <RequireRole roles={['intern', 'admin']}>
              <Inside />
            </RequireRole>
          }
        />
        <Route
          path="/staff/queue"
          element={
            <RequireRole roles={['intern', 'admin']}>
              <Queue />
            </RequireRole>
          }
        />
        <Route
          path="/staff/inventory"
          element={
            <RequireRole roles={['intern', 'admin']}>
              <Inventory />
            </RequireRole>
          }
        />
        <Route
          path="/staff/ideas"
          element={
            <RequireRole roles={['intern', 'admin']}>
              <IdeaPool />
            </RequireRole>
          }
        />
        <Route
          path="/staff/qr"
          element={
            <RequireRole roles={['admin']}>
              <QRPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
