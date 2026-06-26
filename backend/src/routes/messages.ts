import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody } from "../lib/validation";
import { notFound, unauthorized, badRequest } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeContact, serializeMessage } from "../lib/serializers";

export const messagesRouter = Router();

const messageCreateSchema = z.object({
  content: z.string().trim().min(1),
});

messagesRouter.get(
  "/contacts",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) {
      throw unauthorized();
    }

    const [users, messages] = await Promise.all([
      prisma.user.findMany({
        where: { id: { not: req.authUser.id } },
        orderBy: { fullName: "asc" },
      }),
      prisma.message.findMany({
        where: {
          OR: [{ senderId: req.authUser.id }, { recipientId: req.authUser.id }],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    const stats = new Map<
      number,
      { lastMessage: (typeof messages)[number] | null; unread: number }
    >();

    for (const message of messages) {
      const otherId =
        message.senderId === req.authUser.id ? message.recipientId : message.senderId;
      const entry = stats.get(otherId) ?? { lastMessage: null, unread: 0 };
      entry.lastMessage = message;
      if (message.recipientId === req.authUser.id && !message.isRead) {
        entry.unread += 1;
      }
      stats.set(otherId, entry);
    }

    const contacts = users.map((user) =>
      serializeContact({
        user,
        lastMessage: stats.get(user.id)?.lastMessage ?? null,
        unread: stats.get(user.id)?.unread ?? 0,
      }),
    );

    contacts.sort((a, b) => {
      const at = a.last_at ? new Date(a.last_at).getTime() : -1;
      const bt = b.last_at ? new Date(b.last_at).getTime() : -1;
      return bt - at;
    });

    res.json(contacts);
  }),
);

messagesRouter.get(
  "/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      throw badRequest("User id must be a number");
    }
    if (!req.authUser) {
      throw unauthorized();
    }
    if (userId === req.authUser.id) {
      throw badRequest("You cannot message yourself");
    }

    const other = await prisma.user.findUnique({ where: { id: userId } });
    if (!other) {
      throw notFound("User not found");
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.authUser.id, recipientId: userId },
          { senderId: userId, recipientId: req.authUser.id },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    await prisma.message.updateMany({
      where: {
        senderId: userId,
        recipientId: req.authUser.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json(messages.map(serializeMessage));
  }),
);

messagesRouter.post(
  "/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      throw badRequest("User id must be a number");
    }
    const body = parseBody(messageCreateSchema, req.body);

    if (!req.authUser) {
      throw unauthorized();
    }
    if (userId === req.authUser.id) {
      throw badRequest("You cannot message yourself");
    }
    if (!body.content.trim()) {
      throw badRequest("Message cannot be empty");
    }

    const other = await prisma.user.findUnique({ where: { id: userId } });
    if (!other) {
      throw notFound("User not found");
    }

    const message = await prisma.message.create({
      data: {
        content: body.content,
        senderId: req.authUser.id,
        recipientId: userId,
      },
    });

    res.status(201).json(serializeMessage(message));
  }),
);
