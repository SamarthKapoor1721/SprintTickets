import { Router } from "express";
import { z } from "zod";
import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict } from "../lib/validation";
import { notFound, unauthorized, badRequest } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeContact, serializeDirectMessage } from "../lib/serializers";
import { sendDirectMessageEmail } from "../lib/email";
import { resolvePublicAppUrl } from "../lib/public-url";

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
    const authUser = req.authUser;

    const contacts = await prisma.$queryRaw<
      Array<{
        id: number;
        email: string;
        full_name: string | null;
        department: string | null;
        role: string;
        is_active: boolean;
        last_message_id: number | null;
        last_message_content: string | null;
        last_message_sender_id: number | null;
        last_message_recipient_id: number | null;
        last_message_is_read: boolean | null;
        last_message_created_at: Date | null;
        unread: number;
      }>
    >(Prisma.sql`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.department,
        u.role,
        u.is_active,
        lm.id AS last_message_id,
        lm.content AS last_message_content,
        lm.sender_id AS last_message_sender_id,
        lm.recipient_id AS last_message_recipient_id,
        lm.is_read AS last_message_is_read,
        lm.created_at AS last_message_created_at,
        COALESCE(uc.unread, 0)::int AS unread
      FROM users u
      LEFT JOIN LATERAL (
        SELECT dm.id, dm.content, dm.sender_id, dm.recipient_id, dm.is_read, dm.created_at
        FROM direct_messages dm
        WHERE (
          (dm.sender_id = ${authUser.id} AND dm.recipient_id = u.id)
          OR (dm.sender_id = u.id AND dm.recipient_id = ${authUser.id})
        )
        ORDER BY dm.created_at DESC, dm.id DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread
        FROM direct_messages dm
        WHERE dm.sender_id = u.id
          AND dm.recipient_id = ${authUser.id}
          AND dm.is_read = false
      ) uc ON TRUE
      WHERE u.id <> ${authUser.id}
      ORDER BY COALESCE(lm.created_at, 'epoch'::timestamptz) DESC, u.full_name ASC, u.id ASC
    `);

    res.json(
      contacts.map((row) =>
          serializeContact({
            user: {
              id: row.id,
              email: row.email,
              googleId: null,
              hashedPassword: null,
              fullName: row.full_name,
              role: row.role as UserRole,
              department: row.department,
              isActive: row.is_active,
              onboardingToken: null,
              resetPasswordToken: null,
              resetPasswordTokenExpiresAt: null,
            },
          lastMessage:
            row.last_message_id == null
              ? null
              : {
                  id: row.last_message_id,
                  content: row.last_message_content ?? "",
                  senderId: row.last_message_sender_id ?? authUser.id,
                  recipientId: row.last_message_recipient_id ?? authUser.id,
                  isRead: row.last_message_is_read ?? false,
                  createdAt: row.last_message_created_at,
                },
          unread: row.unread,
        }),
      ),
    );
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
    const authUser = req.authUser;
    if (userId === req.authUser.id) {
      throw badRequest("You cannot message yourself");
    }

    const other = await prisma.user.findUnique({ where: { id: userId } });
    if (!other) {
      throw notFound("User not found");
    }

    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.max(1, Math.min(200, parseIntStrict(req.query.limit, "limit")))
      : 100;

    const messages = await prisma.$queryRaw<
      {
        id: number;
        content: string;
        sender_id: number;
        recipient_id: number;
        is_read: boolean;
        created_at: Date | null;
      }[]
    >(Prisma.sql`
      SELECT id, content, sender_id, recipient_id, is_read, created_at
      FROM direct_messages
      WHERE (
        (sender_id = ${authUser.id} AND recipient_id = ${userId})
        OR (sender_id = ${userId} AND recipient_id = ${authUser.id})
      )
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `);

    await prisma.directMessage.updateMany({
      where: {
        senderId: userId,
        recipientId: req.authUser.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json(
      messages
        .reverse()
        .map((message) =>
          serializeDirectMessage({
            id: message.id,
            content: message.content,
            senderId: message.sender_id,
            recipientId: message.recipient_id,
            isRead: message.is_read,
            createdAt: message.created_at,
          }),
        ),
    );
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
      throw badRequest("Direct message cannot be empty");
    }

    const other = await prisma.user.findUnique({ where: { id: userId } });
    if (!other) {
      throw notFound("User not found");
    }

    const message = await prisma.directMessage.create({
      data: {
        content: body.content,
        senderId: req.authUser.id,
        recipientId: userId,
      },
    });

    sendDirectMessageEmail(
      other.email,
      req.authUser.fullName || req.authUser.email,
      body.content,
      resolvePublicAppUrl(req),
    ).catch(console.error);

    res.status(201).json(serializeDirectMessage(message));
  }),
);
