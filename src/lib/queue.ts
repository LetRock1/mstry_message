import { Queue } from "bullmq";
import { redisConnection } from "./redis";

// 1. Primary queue for processing incoming guest & chat messages
export const messageQueue = new Queue("message-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

// 2. Queue for 24-hour guest message auto-deletion
export const guestExpiryQueue = new Queue("guest-expiry-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

// 3. Queue for unread digest email notifications via Gmail
export const emailQueue = new Queue("email-notification-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
  },
});