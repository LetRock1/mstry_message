import { Worker } from "bullmq";
import { Server as SocketServer } from "socket.io";
import mongoose from "mongoose";
import { redis, redisConnection } from "../lib/redis";
import dbConnect from "../lib/dbConnect";
import UserModel from "../model/User";
import ConversationModel from "../model/Conversation";
import { guestExpiryQueue, emailQueue } from "../lib/queue";

declare global {
  var io: SocketServer | undefined;
}

export const initMessageWorker = () => {
  const worker = new Worker(
    "message-processing",
    async (job) => {
      await dbConnect();
      const { type } = job.data;

      if (type === "GUEST_MESSAGE") {
        const { recipientUsername, content, createdAt } = job.data;

        const user = await UserModel.findOne({ username: recipientUsername }).select("isAcceptingMessage email");
        if (!user) throw new Error(`User ${recipientUsername} not found`);

        if (!user.isAcceptingMessage) {
          console.log(`[BullMQ] User ${recipientUsername} is not accepting messages. Skipping job.`);
          return;
        }

        const messageId = new mongoose.Types.ObjectId();
        const newMessage = {
          _id: messageId,
          content,
          createdAt: new Date(createdAt),
        };

        await UserModel.updateOne(
          { _id: user._id },
          { $push: { messages: newMessage } }
        );

        // 🔥 FIX: Add a unique jobId to avoid collisions
        await guestExpiryQueue.add(
          "delete-guest-message",
          { recipientUsername, messageId: messageId.toString() },
          {
            delay: 24 * 60 * 60 * 1000,
            jobId: `expire:${messageId.toString()}`,   // unique per message
            removeOnComplete: true,
          }
        );

        const unreadKey = `unread:${recipientUsername}`;
        const cooldownKey = `email_cooldown:${recipientUsername}`;

        const currentUnread = await redis.incr(unreadKey);

        if (currentUnread >= 10) {
          const isCoolingDown = await redis.get(cooldownKey);

          if (!isCoolingDown && user.email) {
            await redis.set(cooldownKey, "true", "EX", 3600);
            await emailQueue.add("send-unread-digest", {
              recipientId: user._id.toString(),
              unreadCount: currentUnread,
            });
          }
        }

        await redis.del(`user:${recipientUsername}:messages`);

        if (global.io) {
          global.io.to(`user:${recipientUsername}`).emit("newMessage", {
            type: "GUEST_MESSAGE",
            message: newMessage,
          });
        }
      }

      if (type === "CHAT_THREAD_MESSAGE") {
        const { conversationId, senderUsername, recipientUsername, content, senderAlias } = job.data;

        const threadMsg = {
          senderUsername,
          senderAlias: senderAlias || "Anonymous Persona",
          content,
          createdAt: new Date(),
        };

        const updatedConversation = await ConversationModel.findOneAndUpdate(
          conversationId
            ? { _id: conversationId }
            : { participants: { $all: [senderUsername, recipientUsername] } },
          {
            $push: { messages: threadMsg },
            $setOnInsert: { participants: [senderUsername, recipientUsername] },
            $set: { updatedAt: new Date() },
          },
          { upsert: true, new: true }
        );

        const socketPayload = {
          conversationId: updatedConversation._id.toString(),
          message: {
            senderAlias: threadMsg.senderAlias,
            content: threadMsg.content,
            createdAt: threadMsg.createdAt,
          },
        };

        if (global.io) {
          global.io.to(`user:${recipientUsername}`).emit("threadMessage", socketPayload);
          global.io.to(`user:${senderUsername}`).emit("threadMessage", socketPayload);
        }
      }
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("completed", (job) => console.log(`[BullMQ] Job ${job.id} completed successfully`));
  worker.on("failed", (job, err) => console.error(`[BullMQ] Job ${job?.id} failed:`, err));
};