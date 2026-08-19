import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage'
import { DatasetsPage } from '@/features/datasets/pages/DatasetsPage'
import { DatasetItemsPage } from '@/features/datasets/pages/DatasetItemsPage'
import { TasksPage } from '@/features/tasks/pages/TasksPage'
import { ImageStudioPage } from '@/modules/image'
import { listenOnlineFlush, flushSyncQueue } from '@/features/datasets/local/syncQueue'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  useEffect(() => {
    flushSyncQueue().catch(() => undefined)
    return listenOnlineFlush()
  }, [])
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Image studio (modules/image). Video will use /annotate/video/:itemId */}
      <Route
        path="/annotate/:itemId"
        element={
          <ProtectedRoute>
            <ImageStudioPage />
          </ProtectedRoute>
        }
      />

      {/* Protected */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Projects */}
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<DatasetsPage />} />

        {/* Datasets */}
        <Route path="datasets" element={<DatasetsPage />} />
        <Route path="datasets/:datasetId" element={<DatasetItemsPage />} />

        {/* Tasks */}
        <Route path="tasks" element={<TasksPage />} />

        {/* Dataset Explorer (Phase 4) */}
        <Route path="explore" element={<Navigate to="/datasets" replace />} />

        {/* QA */}
        <Route path="qa" element={<div className="p-6">Quality Assurance — Phase 1</div>} />

        {/* Analytics */}
        <Route path="analytics" element={<div className="p-6">Analytics — Phase 4</div>} />

        {/* Admin */}
        <Route path="admin" element={<div className="p-6">Administration</div>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
