export interface User {
  id: string;
  email: string;
  name: string;
}

export interface ProjectMember {
  id: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
  userId: string;
  user: { id: string; name: string; email: string };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  _count?: { tasks: number };
  tasks?: Task[];
  members?: ProjectMember[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  userId: string;
  assigneeId?: string | null;
  project?: { name: string };
  user?: { id: string; name: string };
  assignee?: { id: string; name: string } | null;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}

export interface AIResponse {
  type: "success" | "follow_up" | "error";
  message: string;
  task?: Task;
}
