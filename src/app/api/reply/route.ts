import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) return Response.json({ success: false }, { status: 401 });

    const { content, conversationId, recipientUsername: optionalRecipient } = await req.json();
    if (!content || !conversationId) {
      return Response.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    const currentUser = await UserModel.findOne({ username: session.user.username });
    if (!currentUser) return Response.json({ success: false }, { status: 404 });

    // 1) Try the optional recipientUsername provided by the client
    let otherUsername = optionalRecipient;

    // 2) Fallback: extract from our messages
    if (!otherUsername) {
      const ourMessages = currentUser.messages.filter(
        (m: any) => m.conversationId === conversationId
      );
      if (ourMessages.length === 0) {
        return Response.json({ success: false, message: "Conversation not found" }, { status: 404 });
      }
      for (const msg of ourMessages) {
        if (msg.sender === "me" && msg.recipientUsername) {
          otherUsername = msg.recipientUsername;
          break;
        }
        if (msg.sender === "anonymous" && msg.senderUsername) {
          otherUsername = msg.senderUsername;
          break;
        }
      }
    }

    if (!otherUsername) {
      return Response.json(
        { success: false, message: "Cannot determine who to reply to" },
        { status: 400 }
      );
    }

    const recipient = await UserModel.findOne({ username: otherUsername });
    if (!recipient) return Response.json({ success: false, message: "Recipient not found" }, { status: 404 });

    // Push to recipient
    recipient.messages.push({
      content,
      createdAt: new Date(),
      conversationId,
      sender: "anonymous",
      senderUsername: session.user.username,
    });

    // Push to current user
    currentUser.messages.push({
      content,
      createdAt: new Date(),
      conversationId,
      sender: "me",
      recipientUsername: otherUsername,
    });

    await Promise.all([recipient.save(), currentUser.save()]);

    return Response.json({ success: true, message: "Reply sent" });
  } catch (error) {
    console.error("Reply error:", error);
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}