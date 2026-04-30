import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
});

router.use(authenticate);

// Helper: check if user has access to a project (owner or member)
async function hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
  });
  return !!project;
}

// Get tasks - shows all tasks in projects the user has access to
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    const where: Record<string, unknown> = {
      project: {
        OR: [
          { userId: req.userId! },
          { members: { some: { userId: req.userId! } } },
        ],
      },
    };
    if (projectId) where.projectId = projectId as string;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { name: true } },
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Stats - shows stats for all tasks in projects the user has access to
router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const accessFilter = {
      project: {
        OR: [
          { userId: req.userId! },
          { members: { some: { userId: req.userId! } } },
        ],
      },
    };

    const [total, todo, inProgress, done] = await Promise.all([
      prisma.task.count({ where: accessFilter }),
      prisma.task.count({ where: { ...accessFilter, status: "TODO" } }),
      prisma.task.count({ where: { ...accessFilter, status: "IN_PROGRESS" } }),
      prisma.task.count({ where: { ...accessFilter, status: "DONE" } }),
    ]);
    res.json({ total, todo, inProgress, done });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single task (if user has access to its project)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findFirst({
      where: {
        id,
        project: {
          OR: [
            { userId: req.userId! },
            { members: { some: { userId: req.userId! } } },
          ],
        },
      },
      include: {
        project: { select: { name: true } },
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(task);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create task (user must have access to the project)
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    if (!(await hasProjectAccess(req.userId!, data.projectId))) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // If assigning to someone, verify they are a project member
    if (data.assigneeId) {
      const isMember = await prisma.projectMember.findFirst({
        where: { userId: data.assigneeId, projectId: data.projectId },
      });
      if (!isMember) {
        res.status(400).json({ error: "Assignee must be a project member" });
        return;
      }
    }

    const task = await prisma.task.create({
      data: { ...data, userId: req.userId! },
      include: {
        project: { select: { name: true } },
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update task (any project member can update)
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateTaskSchema.parse(req.body);

    const existing = await prisma.task.findFirst({
      where: {
        id,
        project: {
          OR: [
            { userId: req.userId! },
            { members: { some: { userId: req.userId! } } },
          ],
        },
      },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // If assigning to someone, verify they are a project member
    if (data.assigneeId) {
      const isMember = await prisma.projectMember.findFirst({
        where: { userId: data.assigneeId, projectId: existing.projectId },
      });
      if (!isMember) {
        res.status(400).json({ error: "Assignee must be a project member" });
        return;
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        project: { select: { name: true } },
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete task (any project member can delete)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.task.findFirst({
      where: {
        id,
        project: {
          OR: [
            { userId: req.userId! },
            { members: { some: { userId: req.userId! } } },
          ],
        },
      },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    await prisma.task.delete({ where: { id } });
    res.json({ message: "Task deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
