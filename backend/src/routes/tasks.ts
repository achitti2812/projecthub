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
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

router.use(authenticate);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const where: Record<string, unknown> = { userId: req.userId! };
    if (projectId) where.projectId = projectId as string;

    const tasks = await prisma.task.findMany({
      where,
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const [total, todo, inProgress, done] = await Promise.all([
      prisma.task.count({ where: { userId: req.userId! } }),
      prisma.task.count({
        where: { userId: req.userId!, status: "TODO" },
      }),
      prisma.task.count({
        where: { userId: req.userId!, status: "IN_PROGRESS" },
      }),
      prisma.task.count({
        where: { userId: req.userId!, status: "DONE" },
      }),
    ]);
    res.json({ total, todo, inProgress, done });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findFirst({
      where: { id, userId: req.userId! },
      include: { project: { select: { name: true } } },
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

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: data.projectId, userId: req.userId! },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const task = await prisma.task.create({
      data: { ...data, userId: req.userId! },
      include: { project: { select: { name: true } } },
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

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateTaskSchema.parse(req.body);

    const existing = await prisma.task.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: { project: { select: { name: true } } },
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

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.task.findFirst({
      where: { id, userId: req.userId! },
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
