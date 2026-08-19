import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderKanban, Plus, Search, Trash2 } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { projectsService } from '@/services/projects.service'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Project } from '@/types/annotation.types'

export function ProjectsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createError, setCreateError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(1, 50),
  })

  const createMutation = useMutation({
    mutationFn: projectsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowCreateModal(false)
      setNewName('')
      setNewDesc('')
      setCreateError('')
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') setCreateError(detail)
      else if (Array.isArray(detail)) setCreateError(detail.map((d: any) => d.msg).join(', '))
      else setCreateError('Failed to create project. Is the backend running?')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreateError('')
    createMutation.mutate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
    })
  }

  const projects = data?.items ?? []
  const filteredProjects = projects.filter(
    (p: Project) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-4 fade-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage annotation projects and team access
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="mira-btn-primary">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mira-input pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mira-panel rounded-md divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-destructive/5 border border-destructive/20 text-destructive p-4 rounded-md text-sm">
          Failed to load projects. Ensure the backend server is running.
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="mira-panel rounded-md">
          <EmptyState
            title="No projects found"
            description={
              search
                ? 'No projects match your search.'
                : 'Create your first annotation project to get started.'
            }
            action={
              !search ? { label: 'Create Project', onClick: () => setShowCreateModal(true) } : undefined
            }
          />
        </div>
      ) : (
        <div className="mira-panel rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold">Project Name</th>
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold hidden lg:table-cell">Created</th>
                <th className="text-right px-4 py-2.5 mira-section-label font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project: Project) => (
                <tr key={project.id} className="mira-table-row">
                  <td className="px-4 py-3">
                    <Link to={`/projects/${project.id}`} className="font-medium hover:text-primary">
                      {project.name}
                    </Link>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                        {project.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex px-2 py-0.5 rounded text-2xs font-medium bg-primary/10 text-primary capitalize">
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(project.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link to={`/projects/${project.id}`} className="text-xs text-primary hover:underline font-medium">
                        Open →
                      </Link>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Delete project “${project.name}”? Datasets and annotations in this project will also be removed.`,
                            )
                          ) {
                            deleteMutation.mutate(project.id)
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <Modal
          title="Create Project"
          subtitle="Set up a workspace for datasets and annotation."
          onClose={() => setShowCreateModal(false)}
        >
            {createError && (
              <div className="mb-3 p-2.5 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-3.5">
              <Field label="Project Name" icon={FolderKanban}>
                <input
                  type="text"
                  required
                  placeholder="e.g. Autonomous Driving Camera & LiDAR"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mira-input"
                />
              </Field>
              <div>
                <label className="text-xs font-medium block mb-1.5">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional details…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mira-textarea"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)} className="mira-btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="mira-btn-primary h-9 px-4">
                  {createMutation.isPending ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  )
}
