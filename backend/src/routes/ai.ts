import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();
router.use(authenticate);

const aiActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    projectId: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    taskIdentifier: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    taskIdentifier: z.string().min(1),
  }),
]);

type AIAction = z.infer<typeof aiActionSchema>;

function parseUserInput(input: string): {
  parsed: AIAction | null;
  followUp: string | null;
} {
  const lower = input.toLowerCase().trim();

  if (
    lower.startsWith("create") ||
    lower.startsWith("add") ||
    lower.startsWith("make")
  ) {
    return parseCreateIntent(lower, input);
  }

  if (
    lower.startsWith("move") ||
    lower.startsWith("update") ||
    lower.startsWith("change") ||
    lower.startsWith("set")
  ) {
    return parseUpdateIntent(lower);
  }

  if (
    lower.startsWith("delete") ||
    lower.startsWith("remove") ||
    lower.startsWith("drop")
  ) {
    return parseDeleteIntent(lower);
  }

  return {
    parsed: null,
    followUp:
      'I couldn\'t understand that command. Try something like:\n- "Create a high priority task to fix login bug"\n- "Move payment task to In Progress"\n- "Delete the task related to UI bug"',
  };
}

function parseCreateIntent(
  lower: string,
  original: string
): { parsed: AIAction | null; followUp: string | null } {
  let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
  if (lower.includes("urgent")) priority = "URGENT";
  else if (lower.includes("high priority") || lower.includes("high-priority"))
    priority = "HIGH";
  else if (lower.includes("low priority") || lower.includes("low-priority"))
    priority = "LOW";
  else if (
    lower.includes("medium priority") ||
    lower.includes("medium-priority")
  )
    priority = "MEDIUM";

  let status: "TODO" | "IN_PROGRESS" | "DONE" | undefined;
  if (lower.includes("in progress")) status = "IN_PROGRESS";
  else if (lower.includes("done") || lower.includes("completed"))
    status = "DONE";

  const titlePatterns = [
    /(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:(?:high|low|medium|urgent)\s*[-]?\s*priority\s+)?task\s+(?:to\s+|for\s+|called\s+|named\s+|about\s+)?(.+)/i,
    /(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task\s*:\s*(.+)/i,
    /(?:create|add|make)\s+(.+)/i,
  ];

  let title = "";
  for (const pattern of titlePatterns) {
    const match = original.match(pattern);
    if (match) {
      title = match[1]
        .replace(
          /\b(with|as|in)\s+(high|low|medium|urgent)\s+priority\b/gi,
          ""
        )
        .replace(/\b(to|in)\s+(in progress|done|to do)\b/gi, "")
        .trim();
      break;
    }
  }

  if (!title) {
    return {
      parsed: null,
      followUp:
        "What should the task title be? Please provide a title for the new task.",
    };
  }

  return {
    parsed: { action: "create", title, priority, status },
    followUp: null,
  };
}

function parseUpdateIntent(
  lower: string
): { parsed: AIAction | null; followUp: string | null } {
  let status: "TODO" | "IN_PROGRESS" | "DONE" | undefined;
  if (lower.includes("in progress") || lower.includes("in_progress"))
    status = "IN_PROGRESS";
  else if (lower.includes("done") || lower.includes("completed"))
    status = "DONE";
  else if (lower.includes("to do") || lower.includes("todo")) status = "TODO";

  let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
  if (lower.includes("urgent")) priority = "URGENT";
  else if (lower.includes("high")) priority = "HIGH";
  else if (lower.includes("low")) priority = "LOW";
  else if (lower.includes("medium")) priority = "MEDIUM";

  const moveMatch = lower.match(
    /(?:move|update|change|set)\s+(?:the\s+)?(?:task\s+)?(?:about\s+|related to\s+|called\s+|named\s+)?["']?(.+?)["']?\s+(?:to|as|status)\s+/i
  );

  let taskIdentifier = "";
  if (moveMatch) {
    taskIdentifier = moveMatch[1].trim();
  } else {
    const simpleMatch = lower.match(
      /(?:move|update|change|set)\s+(?:the\s+)?(?:task\s+)?(.+)/i
    );
    if (simpleMatch) {
      taskIdentifier = simpleMatch[1]
        .replace(
          /\s+(?:to|as)\s+(?:in progress|done|to do|todo|high|low|medium|urgent).*$/i,
          ""
        )
        .trim();
    }
  }

  if (!taskIdentifier) {
    return {
      parsed: null,
      followUp: "Which task would you like to update? Please provide the task name.",
    };
  }

  if (!status && !priority) {
    return {
      parsed: null,
      followUp: `What would you like to change about "${taskIdentifier}"? (status: To Do, In Progress, Done; or priority: Low, Medium, High, Urgent)`,
    };
  }

  return {
    parsed: { action: "update", taskIdentifier, status, priority },
    followUp: null,
  };
}

function parseDeleteIntent(
  lower: string
): { parsed: AIAction | null; followUp: string | null } {
  const match = lower.match(
    /(?:delete|remove|drop)\s+(?:the\s+)?(?:task\s+)?(?:about\s+|related to\s+|called\s+|named\s+)?(.+)/i
  );

  if (!match) {
    return {
      parsed: null,
      followUp: "Which task would you like to delete? Please provide the task name.",
    };
  }

  return {
    parsed: { action: "delete", taskIdentifier: match[1].trim() },
    followUp: null,
  };
}

async function findTaskByIdentifier(identifier: string, userId: string) {
  const exactMatch = await prisma.task.findFirst({
    where: {
      userId,
      title: { equals: identifier, mode: "insensitive" },
    },
    include: { project: { select: { name: true } } },
  });
  if (exactMatch) return exactMatch;

  const partialMatch = await prisma.task.findFirst({
    where: {
      userId,
      title: { contains: identifier, mode: "insensitive" },
    },
    include: { project: { select: { name: true } } },
  });
  return partialMatch;
}

router.post("/command", async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const { parsed, followUp } = parseUserInput(message);

    if (followUp) {
      res.json({ type: "follow_up", message: followUp });
      return;
    }

    if (!parsed) {
      res.json({
        type: "error",
        message: "Could not parse the command.",
      });
      return;
    }

    switch (parsed.action) {
      case "create": {
        const projects = await prisma.project.findMany({
          where: { userId: req.userId! },
          orderBy: { createdAt: "desc" },
        });

        let projectId = parsed.projectId;
        if (!projectId) {
          if (projects.length === 0) {
            res.json({
              type: "follow_up",
              message:
                "You don't have any projects yet. Please create a project first.",
            });
            return;
          }
          projectId = projects[0].id;
        }

        const task = await prisma.task.create({
          data: {
            title: parsed.title,
            description: parsed.description,
            status: parsed.status || "TODO",
            priority: parsed.priority || "MEDIUM",
            projectId,
            userId: req.userId!,
          },
          include: { project: { select: { name: true } } },
        });

        res.json({
          type: "success",
          message: `Created task "${task.title}" in project "${task.project.name}" with ${task.priority} priority and status ${task.status}.`,
          task,
        });
        break;
      }

      case "update": {
        const task = await findTaskByIdentifier(
          parsed.taskIdentifier,
          req.userId!
        );
        if (!task) {
          res.json({
            type: "follow_up",
            message: `I couldn't find a task matching "${parsed.taskIdentifier}". Please check the task name and try again.`,
          });
          return;
        }

        const updateData: Record<string, string> = {};
        if (parsed.status) updateData.status = parsed.status;
        if (parsed.priority) updateData.priority = parsed.priority;
        if (parsed.title) updateData.title = parsed.title;

        const updated = await prisma.task.update({
          where: { id: task.id },
          data: updateData,
          include: { project: { select: { name: true } } },
        });

        const changes = [];
        if (parsed.status) changes.push(`status to ${parsed.status}`);
        if (parsed.priority) changes.push(`priority to ${parsed.priority}`);

        res.json({
          type: "success",
          message: `Updated task "${updated.title}": ${changes.join(", ")}.`,
          task: updated,
        });
        break;
      }

      case "delete": {
        const task = await findTaskByIdentifier(
          parsed.taskIdentifier,
          req.userId!
        );
        if (!task) {
          res.json({
            type: "follow_up",
            message: `I couldn't find a task matching "${parsed.taskIdentifier}". Please check the task name and try again.`,
          });
          return;
        }

        await prisma.task.delete({ where: { id: task.id } });

        res.json({
          type: "success",
          message: `Deleted task "${task.title}" from project "${task.project.name}".`,
        });
        break;
      }
    }
  } catch (error) {
    console.error("AI command error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
