import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
});

router.use(authenticate);

// Get all projects the user owns or is a member of
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId: req.userId! },
          { members: { some: { userId: req.userId! } } },
        ],
      },
      include: {
        _count: { select: { tasks: true } },
        user: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single project (if owner or member)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { userId: req.userId! },
          { members: { some: { userId: req.userId! } } },
        ],
      },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
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

// Create project (creator becomes OWNER member automatically)
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        ...data,
        userId: req.userId!,
        members: {
          create: { userId: req.userId!, role: "OWNER" },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
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

// Update project (owner only)
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
    const updated = await prisma.project.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete project (owner only)
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

// Add member to project by email
router.post("/:id/members", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const { email } = addMemberSchema.parse(req.body);

    // Only owner can add members
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId! },
    });
    if (!project) {
      res.status(403).json({ error: "Only the project owner can add members" });
      return;
    }

    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      res.status(404).json({ error: "No user found with that email" });
      return;
    }

    if (userToAdd.id === req.userId) {
      res.status(400).json({ error: "You are already the project owner" });
      return;
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: userToAdd.id, projectId } },
    });
    if (existingMember) {
      res.status(400).json({ error: "User is already a member" });
      return;
    }

    const member = await prisma.projectMember.create({
      data: { userId: userToAdd.id, projectId, role: "MEMBER" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove member from project
router.delete("/:id/members/:memberId", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const memberId = req.params.memberId as string;

    // Only owner can remove members
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId! },
    });
    if (!project) {
      res.status(403).json({ error: "Only the project owner can remove members" });
      return;
    }

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.projectId !== projectId) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (member.role === "OWNER") {
      res.status(400).json({ error: "Cannot remove the project owner" });
      return;
    }

    await prisma.projectMember.delete({ where: { id: memberId } });
    res.json({ message: "Member removed" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get project members
router.get("/:id/members", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;

    // Check user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId: req.userId! },
          { members: { some: { userId: req.userId! } } },
        ],
      },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(members);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
