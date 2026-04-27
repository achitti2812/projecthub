import { useState, useEffect, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import { Project, Task, TaskStatus, Priority } from "../types";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<Priority>("MEDIUM");

  const fetchProject = async () => {
    const res = await client.get(`/projects/${id}`);
    setProject(res.data);
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("TODO");
    setPriority("MEDIUM");
    setEditingTask(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      await client.put(`/tasks/${editingTask.id}`, {
        title,
        description,
        status,
        priority,
      });
    } else {
      await client.post("/tasks", {
        title,
        description,
        status,
        priority,
        projectId: id,
      });
    }
    resetForm();
    fetchProject();
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority);
    setShowForm(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await client.delete(`/tasks/${taskId}`);
    fetchProject();
  };

  if (!project) return <div className="loading">Loading project...</div>;

  const statusLabel: Record<TaskStatus, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    DONE: "Done",
  };

  const priorityClass: Record<Priority, string> = {
    LOW: "priority-low",
    MEDIUM: "priority-medium",
    HIGH: "priority-high",
    URGENT: "priority-urgent",
  };

  return (
    <div className="project-detail">
      <div className="page-header">
        <div>
          <h1>{project.name}</h1>
          {project.description && <p>{project.description}</p>}
        </div>
        <div className="header-actions">
          <Link to={`/projects/${id}/kanban`} className="btn">
            Kanban Board
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
          >
            {showForm ? "Cancel" : "+ New Task"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="create-form">
          <div className="form-group">
            <label>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Task title"
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
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            {editingTask ? "Update Task" : "Create Task"}
          </button>
        </form>
      )}

      {(!project.tasks || project.tasks.length === 0) ? (
        <p className="empty-state">No tasks yet. Create your first task!</p>
      ) : (
        <div className="task-list">
          {project.tasks.map((task) => (
            <div key={task.id} className="task-card">
              <div className="task-info">
                <h3>{task.title}</h3>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <span className={`badge ${task.status.toLowerCase()}`}>
                    {statusLabel[task.status]}
                  </span>
                  <span className={`badge ${priorityClass[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
              </div>
              <div className="task-actions">
                <button
                  onClick={() => startEdit(task)}
                  className="btn btn-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
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
