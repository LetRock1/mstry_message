import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import { isUserAcceptingMessages } from "@/lib/redisHelpers";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) return Response.json({ success: false }, { status: 401 });

    const { recipientUsername, content } = await req.json();

    if (recipientUsername === session.user.username) {
      return Response.json(
        { success: false, message: "You cannot send a message to yourself" },
        { status: 400 }
      );
    }

    // THIS must run
    const isAccepting = await isUserAcceptingMessages(recipientUsername);
    if (!isAccepting) {
      return Response.json(
        { success: false, message: "User is not accepting messages" },
        { status: 403 }
      );
    }

    const recipient = await UserModel.findOne({ username: recipientUsername });
    if (!recipient) return Response.json({ success: false, message: "User not found" }, { status: 404 });
    if (recipient.blockedUsers?.includes(session.user.username)) {
      return Response.json(
        { success: false, message: "You are blocked by this user" },
        { status: 403 }
      );
    }

    const senderUser = await UserModel.findOne({ username: session.user.username });
    const existingConv = senderUser?.messages.find(
      (m: any) => m.conversationId && m.recipientUsername === recipientUsername
    );
    const conversationId = existingConv ? existingConv.conversationId : Date.now().toString();

    recipient.messages.push({
      content,
      createdAt: new Date(),
      conversationId,
      sender: "anonymous",
      senderUsername: session.user.username,
    });

    senderUser!.messages.push({
      content,
      createdAt: new Date(),
      conversationId,
      sender: "me",
      recipientUsername,
    });

    await Promise.all([recipient.save(), senderUser!.save()]);
    await redis.incr(`unread:${recipientUsername}`);

    if (global.io) {
      global.io.to(`user:${recipientUsername}`).emit("newMessage", {
        _id: recipient.messages[recipient.messages.length - 1]._id?.toString(),
        content,
        createdAt: new Date(),
        conversationId,
        sender: "anonymous",
        senderUsername: session.user.username,
      });
    }

    return Response.json({ success: true, conversationId });
  } catch (e) {
    console.error("send-mystery error:", e);
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}