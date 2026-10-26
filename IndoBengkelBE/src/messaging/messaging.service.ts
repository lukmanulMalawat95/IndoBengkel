import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { uid } from "../common/ids";
import { conversationJson, messageJson, notificationJson } from "../common/serializers";

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(user: any, scope: string) {
    let where: any = { customerId: user.id };
    if (scope === "workshop") {
      const workshop = await this.ownerWorkshop(user);
      where = { workshopId: workshop.id };
    }
    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return conversations
      .map((conversation) => {
        const last = conversation.messages[conversation.messages.length - 1];
        const unreadCount = conversation.messages.filter(
          (message) => message.senderUserId !== user.id && !message.readAt,
        ).length;
        return conversationJson(conversation, {
          lastMessage: last?.body,
          unreadCount,
        });
      })
      .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  }

  async getConversation(user: any, id: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
    await this.assertAccess(user, conversation);
    const messages = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });
    return {
      conversation: conversationJson(conversation),
      messages: messages.map(messageJson),
    };
  }

  async startConversation(user: any, workshopId: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { customerId_workshopId: { customerId: user.id, workshopId } },
    });
    if (existing) return conversationJson(existing);

    const workshop = await this.prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);

    const conversation = await this.prisma.conversation.create({
      data: {
        id: uid("conv"),
        customerId: user.id,
        customerName: user.fullName,
        workshopId: workshop.id,
        workshopName: workshop.name,
        workshopSlug: workshop.slug,
        lastMessageAt: new Date(),
      },
    });
    return conversationJson(conversation);
  }

  async sendMessage(user: any, conversationId: string, body: string, attachmentUrl?: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
    await this.assertAccess(user, conversation);

    const text = String(body ?? "");
    if (!text.trim() && !attachmentUrl) {
      throw new ApiError("VALIDATION_ERROR", "Write a message first.", 422);
    }
    if (text.length > 2000) {
      throw new ApiError("VALIDATION_ERROR", "Messages are limited to 2,000 characters.", 422);
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          id: uid("msg"),
          conversationId,
          senderUserId: user.id,
          senderName: user.fullName,
          senderRole: user.role,
          body: text.trim(),
          attachmentUrl: attachmentUrl ? String(attachmentUrl) : null,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      const workshop = await tx.workshop.findUnique({ where: { id: conversation.workshopId } });
      const recipientId =
        user.role === "customer" ? workshop?.ownerUserId : conversation.customerId;
      if (recipientId) {
        await tx.notification.create({
          data: {
            id: uid("notif"),
            userId: recipientId,
            type: "chat_message",
            title: "New chat message",
            body: `${user.fullName}: ${text.slice(0, 80)}`,
            href:
              user.role === "customer"
                ? `/workshop/chat?thread=${conversationId}`
                : `/chat/${conversationId}`,
          },
        });
      }
      return created;
    });
    return messageJson(message);
  }

  async markConversationRead(user: any, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
    await this.assertAccess(user, conversation);
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderUserId: { not: user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async listNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return notifications.map(notificationJson);
  }

  async markNotificationRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null;
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return notificationJson(updated);
  }

  async markAllNotificationsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  private async ownerWorkshop(user: any) {
    if (user.role !== "workshop_owner") {
      throw new ApiError("FORBIDDEN", "You do not have access to this resource.", 403);
    }
    const workshop = await this.prisma.workshop.findUnique({
      where: { ownerUserId: user.id },
    });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    return workshop;
  }

  private async assertAccess(user: any, conversation: any) {
    if (conversation.customerId === user.id) return;
    if (user.role === "workshop_owner") {
      const workshop = await this.prisma.workshop.findUnique({
        where: { ownerUserId: user.id },
      });
      if (workshop && conversation.workshopId === workshop.id) return;
    }
    throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
  }
}
