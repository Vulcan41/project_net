import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyProjects } from './dashboardService.js'
import { supabase } from '@core/supabase.js'

export default function DashboardPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getMyProjects()
      .then(setProjects)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleNewProject() {
    navigate('/project/new')
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#888' }}>Your projects collection</p>
        </div>
        <button onClick={handleNewProject} style={{ padding: '0.6rem 1.2rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '3rem', textAlign: 'center', color: '#aaa' }}>
          No projects yet. Create your first one!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} onClick={() => navigate(`/project/${project.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, onClick }) {
  const initial = project.name?.[0]?.toUpperCase() ?? 'P'
  return (
    <div onClick={onClick} style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.3rem', flexShrink: 0 }}>
          {project.avatar_url ? <img src={project.avatar_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: '600', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</div>
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.description}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: '#f0f0f0', color: '#555' }}>{project.visibility}</span>
        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: '#e8f0fe', color: 'var(--accent)' }}>{project.role}</span>
      </div>
    </div>
  )
}
