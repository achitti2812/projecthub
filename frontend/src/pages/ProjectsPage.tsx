import { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { Project } from "../types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    const res = await client.get("/projects");
    setProjects(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await client.post("/projects", { name, description });
    setName("");
    setDescription("");
    setShowForm(false);
    fetchProjects();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project and all its tasks?")) return;
    await client.delete(`/projects/${id}`);
    fetchProjects();
  };

  if (loading) return <div className="loading">Loading projects...</div>;

  return (
    <div className="projects-page">
      <div className="page-header">
        <h1>Projects</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="create-form">
          <div className="form-group">
            <label>Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter project name"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Create Project
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <p className="empty-state">
          No projects yet. Create your first one!
        </p>
      ) : (
        <div className="project-list">
          {projects.map((p) => (
            <div key={p.id} className="project-card">
              <div className="project-info">
                <Link to={`/projects/${p.id}`}>
                  <h3>{p.name}</h3>
                </Link>
                <p>{p.description || "No description"}</p>
                <span className="task-count">
                  {p._count?.tasks || 0} tasks
                </span>
              </div>
              <div className="project-actions">
                <Link
                  to={`/projects/${p.id}/kanban`}
                  className="btn btn-sm"
                >
                  Kanban
                </Link>
                <Link to={`/projects/${p.id}`} className="btn btn-sm">
                  View
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="btn btn-sm btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
