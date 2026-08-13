import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import dbConnect from "../lib/dbConnect";
import UserModel from "../model/User";

export const guestExpiryWorker = new Worker(
  "guest-expiry-queue",
  async (job) => {
    await dbConnect();
    const { recipientUsername, messageId } = job.data;

    console.log(`[Expiry Worker] Deleting guest message ${messageId} for user ${recipientUsername}`);

    // Pull subdocument message from user.messages array
    await UserModel.updateOne(
      { username: recipientUsername },
      { $pull: { messages: { _id: messageId } } }
    );
  },
  { connection: redisConnection }
);