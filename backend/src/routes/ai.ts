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
    assigneeName: z.string().optional(),
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
  z.object({
    action: z.literal("assign"),
    taskIdentifier: z.string().min(1),
    assigneeName: z.string().min(1),
  }),
  z.object({
    action: z.literal("unassign"),
    taskIdentifier: z.string().min(1),
  }),
  z.object({
    action: z.literal("list"),
    filter: z.enum(["all", "mine", "assigned_to_me", "unassigned"]).optional(),
  }),
]);

type AIAction = z.infer<typeof aiActionSchema>;

function parseUserInput(input: string): {
  parsed: AIAction | null;
  followUp: string | null;
} {
  const lower = input.toLowerCase().trim();

  if (
    lower.startsWith("assign") &&
    !lower.startsWith("assigned")
  ) {
    return parseAssignIntent(lower);
  }

  if (
    lower.startsWith("unassign") ||
    (lower.startsWith("remove") && lower.includes("assignment"))
  ) {
    return parseUnassignIntent(lower);
  }

  if (
    lower.startsWith("list") ||
    lower.startsWith("show") ||
    lower.startsWith("what") ||
    lower.startsWith("get")
  ) {
    return parseListIntent(lower);
  }

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
      'I couldn\'t understand that command. Try something like:\n' +
      '- "Create a high priority task to fix login bug"\n' +
      '- "Move payment task to In Progress"\n' +
      '- "Delete the task related to UI bug"\n' +
      '- "Assign login task to John"\n' +
      '- "Show my tasks"\n' +
      '- "List unassigned tasks"',
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

  let assigneeName: string | undefined;
  const assignMatch = lower.match(
    /\b(?:assign(?:ed)?\s+to|for)\s+([a-z][a-z\s]*?)(?:\s+(?:with|as|in)\s+|$)/i
  );
  if (assignMatch) {
    assigneeName = assignMatch[1].trim();
  }

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
        .replace(/\b(?:assign(?:ed)?\s+to|for)\s+[a-z][a-z\s]*$/i, "")
        .replace(/\band\s+assign.*$/i, "")
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
    parsed: { action: "create", title, priority, status, assigneeName },
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

function parseAssignIntent(
  lower: string
): { parsed: AIAction | null; followUp: string | null } {
  // "assign <task> to <person>"
  const match = lower.match(
    /assign\s+(?:the\s+)?(?:task\s+)?(?:about\s+|related to\s+|called\s+|named\s+)?["']?(.+?)["']?\s+to\s+(.+)/i
  );

  if (!match) {
    return {
      parsed: null,
      followUp:
        'Please specify the task and person. Example: "Assign login bug to John"',
    };
  }

  const taskIdentifier = match[1].trim();
  const assigneeName = match[2].trim();

  if (!taskIdentifier) {
    return {
      parsed: null,
      followUp: "Which task would you like to assign?",
    };
  }
  if (!assigneeName) {
    return {
      parsed: null,
      followUp: `Who would you like to assign "${taskIdentifier}" to?`,
    };
  }

  return {
    parsed: { action: "assign", taskIdentifier, assigneeName },
    followUp: null,
  };
}

function parseUnassignIntent(
  lower: string
): { parsed: AIAction | null; followUp: string | null } {
  const match = lower.match(
    /(?:unassign|remove\s+assignment\s+(?:from|of))\s+(?:the\s+)?(?:task\s+)?(?:about\s+|related to\s+|called\s+|named\s+)?(.+)/i
  );

  if (!match) {
    return {
      parsed: null,
      followUp: "Which task would you like to unassign?",
    };
  }

  return {
    parsed: { action: "unassign", taskIdentifier: match[1].trim() },
    followUp: null,
  };
}

function parseListIntent(
  lower: string
): { parsed: AIAction | null; followUp: string | null } {
  let filter: "all" | "mine" | "assigned_to_me" | "unassigned" | undefined;

  if (lower.includes("my task") || lower.includes("i created") || lower.includes("mine")) {
    filter = "mine";
  } else if (lower.includes("assigned to me")) {
    filter = "assigned_to_me";
  } else if (lower.includes("unassigned") || lower.includes("not assigned")) {
    filter = "unassigned";
  } else {
    filter = "all";
  }

  return {
    parsed: { action: "list", filter },
    followUp: null,
  };
}

// Helper: get the project access filter for a user
function projectAccessFilter(userId: string) {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

async function findTaskByIdentifier(identifier: string, userId: string) {
  const accessFilter = {
    project: projectAccessFilter(userId),
  };

  const exactMatch = await prisma.task.findFirst({
    where: {
      ...accessFilter,
      title: { equals: identifier, mode: "insensitive" as const },
    },
    include: {
      project: { select: { name: true } },
      user: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  if (exactMatch) return exactMatch;

  const partialMatch = await prisma.task.findFirst({
    where: {
      ...accessFilter,
      title: { contains: identifier, mode: "insensitive" as const },
    },
    include: {
      project: { select: { name: true } },
      user: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  return partialMatch;
}

async function findMemberByName(name: string, projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const lowerName = name.toLowerCase();
  const exact = members.find(
    (m) => m.user.name.toLowerCase() === lowerName
  );
  if (exact) return exact.user;

  const partial = members.find(
    (m) => m.user.name.toLowerCase().includes(lowerName)
  );
  if (partial) return partial.user;

  const emailMatch = members.find(
    (m) => m.user.email.toLowerCase().includes(lowerName)
  );
  if (emailMatch) return emailMatch.user;

  return null;
}

function formatTaskInfo(task: {
  title: string;
  status: string;
  priority: string;
  project: { name: string };
  user?: { name: string } | null;
  assignee?: { name: string } | null;
}) {
  let info = `"${task.title}" [${task.status}/${task.priority}] in "${task.project.name}"`;
  if (task.user) info += ` (by ${task.user.name})`;
  if (task.assignee) info += ` → assigned to ${task.assignee.name}`;
  return info;
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
          where: projectAccessFilter(req.userId!),
          orderBy: { createdAt: "desc" },
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
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

        let assigneeId: string | undefined;
        if (parsed.assigneeName) {
          const member = await findMemberByName(parsed.assigneeName, projectId);
          if (!member) {
            const projectMembers = await prisma.projectMember.findMany({
              where: { projectId },
              include: { user: { select: { name: true } } },
            });
            const memberNames = projectMembers.map((m) => m.user.name).join(", ");
            res.json({
              type: "follow_up",
              message: `Could not find a team member named "${parsed.assigneeName}". Available members: ${memberNames || "none"}`,
            });
            return;
          }
          assigneeId = member.id;
        }

        const task = await prisma.task.create({
          data: {
            title: parsed.title,
            description: parsed.description,
            status: parsed.status || "TODO",
            priority: parsed.priority || "MEDIUM",
            projectId,
            userId: req.userId!,
            assigneeId: assigneeId || null,
          },
          include: {
            project: { select: { name: true } },
            user: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        });

        let msg = `Created task "${task.title}" in project "${task.project.name}" with ${task.priority} priority and status ${task.status}.`;
        if (task.assignee) {
          msg += ` Assigned to ${task.assignee.name}.`;
        }

        res.json({ type: "success", message: msg, task });
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
            message: `I couldn't find a task matching "${parsed.taskIdentifier}" in your projects. Please check the task name and try again.`,
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
          include: {
            project: { select: { name: true } },
            user: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        });

        const changes = [];
        if (parsed.status) changes.push(`status to ${parsed.status}`);
        if (parsed.priority) changes.push(`priority to ${parsed.priority}`);

        let msg = `Updated task "${updated.title}": ${changes.join(", ")}.`;
        if (updated.assignee) {
          msg += ` (assigned to ${updated.assignee.name})`;
        }

        res.json({ type: "success", message: msg, task: updated });
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
            message: `I couldn't find a task matching "${parsed.taskIdentifier}" in your projects. Please check the task name and try again.`,
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

      case "assign": {
        const task = await findTaskByIdentifier(
          parsed.taskIdentifier,
          req.userId!
        );
        if (!task) {
          res.json({
            type: "follow_up",
            message: `I couldn't find a task matching "${parsed.taskIdentifier}" in your projects. Please check the task name and try again.`,
          });
          return;
        }

        const member = await findMemberByName(parsed.assigneeName, task.projectId);
        if (!member) {
          const projectMembers = await prisma.projectMember.findMany({
            where: { projectId: task.projectId },
            include: { user: { select: { name: true } } },
          });
          const memberNames = projectMembers.map((m) => m.user.name).join(", ");
          res.json({
            type: "follow_up",
            message: `Could not find a team member named "${parsed.assigneeName}" in project "${task.project.name}". Available members: ${memberNames || "none"}`,
          });
          return;
        }

        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { assigneeId: member.id },
          include: {
            project: { select: { name: true } },
            user: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        });

        res.json({
          type: "success",
          message: `Assigned task "${updated.title}" to ${member.name} in project "${updated.project.name}".`,
          task: updated,
        });
        break;
      }

      case "unassign": {
        const task = await findTaskByIdentifier(
          parsed.taskIdentifier,
          req.userId!
        );
        if (!task) {
          res.json({
            type: "follow_up",
            message: `I couldn't find a task matching "${parsed.taskIdentifier}" in your projects.`,
          });
          return;
        }

        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { assigneeId: null },
          include: {
            project: { select: { name: true } },
            user: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        });

        res.json({
          type: "success",
          message: `Unassigned task "${updated.title}" in project "${updated.project.name}".`,
          task: updated,
        });
        break;
      }

      case "list": {
        const accessFilter = {
          project: projectAccessFilter(req.userId!),
        };

        let where: Record<string, unknown> = { ...accessFilter };

        if (parsed.filter === "mine") {
          where = { ...where, userId: req.userId! };
        } else if (parsed.filter === "assigned_to_me") {
          where = { ...where, assigneeId: req.userId! };
        } else if (parsed.filter === "unassigned") {
          where = { ...where, assigneeId: null };
        }

        const tasks = await prisma.task.findMany({
          where,
          include: {
            project: { select: { name: true } },
            user: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });

        if (tasks.length === 0) {
          res.json({
            type: "success",
            message: "No tasks found matching that filter.",
          });
          return;
        }

        const taskLines = tasks.map(
          (t, i) => `${i + 1}. ${formatTaskInfo(t)}`
        );

        const filterLabel =
          parsed.filter === "mine"
            ? "your"
            : parsed.filter === "assigned_to_me"
            ? "assigned to you"
            : parsed.filter === "unassigned"
            ? "unassigned"
            : "all";

        res.json({
          type: "success",
          message: `Found ${tasks.length} ${filterLabel} task(s):\n${taskLines.join("\n")}`,
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
