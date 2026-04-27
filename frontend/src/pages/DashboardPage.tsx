import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { TaskStats, Project } from "../types";

export default function DashboardPage() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    Promise.all([client.get("/tasks/stats"), client.get("/projects")]).then(
      ([statsRes, projectsRes]) => {
        setStats(statsRes.data);
        setProjects(projectsRes.data);
      }
    );
  }, []);

  if (!stats) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Tasks</h3>
          <span className="stat-number">{stats.total}</span>
        </div>
        <div className="stat-card todo">
          <h3>To Do</h3>
          <span className="stat-number">{stats.todo}</span>
        </div>
        <div className="stat-card in-progress">
          <h3>In Progress</h3>
          <span className="stat-number">{stats.inProgress}</span>
        </div>
        <div className="stat-card done">
          <h3>Done</h3>
          <span className="stat-number">{stats.done}</span>
        </div>
      </div>

      <h2>Recent Projects</h2>
      {projects.length === 0 ? (
        <p>
          No projects yet.{" "}
          <Link to="/projects">Create your first project</Link>
        </p>
      ) : (
        <div className="project-list">
          {projects.slice(0, 5).map((p) => (
            <Link to={`/projects/${p.id}`} key={p.id} className="project-card">
              <h3>{p.name}</h3>
              <p>{p.description || "No description"}</p>
              <span className="task-count">
                {p._count?.tasks || 0} tasks
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
