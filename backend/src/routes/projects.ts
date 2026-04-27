import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.use(authenticate);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.userId! },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId! },
      include: { tasks: { orderBy: { createdAt: "desc" } } },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: { ...data, userId: req.userId! },
    });
    res.status(201).json(project);
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
    const data = createProjectSchema.parse(req.body);
    const project = await prisma.project.updateMany({
      where: { id, userId: req.userId! },
      data,
    });
    if (project.count === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const updated = await prisma.project.findUnique({
      where: { id },
    });
    res.json(updated);
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
    const result = await prisma.project.deleteMany({
      where: { id, userId: req.userId! },
    });
    if (result.count === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ message: "Project deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
