import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import client from "../api/client";
import { Task, TaskStatus, Priority } from "../types";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "DONE", label: "Done" },
];

const priorityClass: Record<Priority, string> = {
  LOW: "priority-low",
  MEDIUM: "priority-medium",
  HIGH: "priority-high",
  URGENT: "priority-urgent",
};

export default function KanbanPage() {
  const { id } = useParams<{ id: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    client.get(`/projects/${id}`).then((res) => {
      setTasks(res.data.tasks || []);
      setProjectName(res.data.name);
    });
  }, [id]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await client.put(`/tasks/${taskId}`, { status: newStatus });
    } catch {
      const res = await client.get(`/projects/${id}`);
      setTasks(res.data.tasks || []);
    }
  };

  const getColumnTasks = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  return (
    <div className="kanban-page">
      <div className="page-header">
        <h1>Kanban: {projectName}</h1>
        <Link to={`/projects/${id}`} className="btn">
          Back to Project
        </Link>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`kanban-column ${col.id.toLowerCase()}`}>
              <h2>
                {col.label}{" "}
                <span className="count">{getColumnTasks(col.id).length}</span>
              </h2>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-list ${
                      snapshot.isDraggingOver ? "drag-over" : ""
                    }`}
                  >
                    {getColumnTasks(col.id).map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`kanban-card ${
                              snapshot.isDragging ? "dragging" : ""
                            }`}
                          >
                            <h4>{task.title}</h4>
                            {task.description && (
                              <p>{task.description}</p>
                            )}
                            <div className="kanban-card-meta">
                              <span
                                className={`badge ${priorityClass[task.priority]}`}
                              >
                                {task.priority}
                              </span>
                              {task.assignee && (
                                <span className="badge assignee-badge">
                                  {task.assignee.name}
                                </span>
                              )}
                              {task.user && (
                                <span className="kanban-creator">
                                  {task.user.name}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
