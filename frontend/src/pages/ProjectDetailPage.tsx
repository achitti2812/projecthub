import { useState, useEffect, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import { Project, Task, TaskStatus, Priority, ProjectMember } from "../types";
import { useAuth } from "../context/AuthContext";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState("");

  const fetchProject = async () => {
    const res = await client.get(`/projects/${id}`);
    setProject(res.data);
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const isOwner = project && user && project.userId === user.id;

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("TODO");
    setPriority("MEDIUM");
    setAssigneeId("");
    setEditingTask(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title,
      description,
      status,
      priority,
    };
    if (assigneeId) payload.assigneeId = assigneeId;
    else payload.assigneeId = null;

    if (editingTask) {
      await client.put(`/tasks/${editingTask.id}`, payload);
    } else {
      await client.post("/tasks", { ...payload, projectId: id });
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
    setAssigneeId(task.assigneeId || "");
    setShowForm(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await client.delete(`/tasks/${taskId}`);
    fetchProject();
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    setMemberError("");
    try {
      await client.post(`/projects/${id}/members`, { email: memberEmail });
      setMemberEmail("");
      setShowMemberForm(false);
      fetchProject();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMemberError(error.response?.data?.error || "Failed to add member");
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    if (!confirm(`Remove ${member.user.name} from this project?`)) return;
    await client.delete(`/projects/${id}/members/${member.id}`);
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

  const members = project.members || [];

  return (
    <div className="project-detail">
      <div className="page-header">
        <div>
          <h1>{project.name}</h1>
          {project.description && <p>{project.description}</p>}
          {project.user && (
            <span className="owner-badge">Owner: {project.user.name}</span>
          )}
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

      {/* Members Section */}
      <div className="members-section">
        <div className="members-header">
          <h2>Team Members ({members.length})</h2>
          {isOwner && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowMemberForm(!showMemberForm)}
            >
              {showMemberForm ? "Cancel" : "+ Add Member"}
            </button>
          )}
        </div>

        {showMemberForm && (
          <form onSubmit={handleAddMember} className="add-member-form">
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="Enter member's email"
              required
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Add
            </button>
            {memberError && <span className="error-text">{memberError}</span>}
          </form>
        )}

        <div className="members-list">
          {members.map((m) => (
            <div key={m.id} className="member-chip">
              <span className="member-name">{m.user.name}</span>
              <span className="member-role">{m.role}</span>
              {isOwner && m.role !== "OWNER" && (
                <button
                  className="member-remove"
                  onClick={() => handleRemoveMember(m)}
                  title="Remove member"
                >
                  x
                </button>
              )}
            </div>
          ))}
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
            <div className="form-group">
              <label>Assign To</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
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
                  {task.user && (
                    <span className="badge creator-badge">
                      By: {task.user.name}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="badge assignee-badge">
                      Assigned: {task.assignee.name}
                    </span>
                  )}
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
