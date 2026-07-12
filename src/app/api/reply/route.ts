import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { username: recipientUsername, content, conversationId } = await req.json();

    if (!recipientUsername || !content || !conversationId) {
      return Response.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    const recipient = await UserModel.findOne({ username: recipientUsername });
    if (!recipient) {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Find all messages in this conversation
    const convMsgs = recipient.messages.filter((m: any) => m.conversationId === conversationId);

    if (convMsgs.length === 0) {
      return Response.json({ success: false, message: "Conversation not found" }, { status: 404 });
    }

    // Get the FIRST message in the conversation (oldest one)
    // Assuming messages are appended in chronological order
    const firstMessage = convMsgs[0];

    // Block ONLY if the conversation STARTED with true anonymous
    const isTrueAnonymousConversation = firstMessage.sender === "anonymous";

    if (isTrueAnonymousConversation) {
      return Response.json(
        { success: false, message: "Cannot reply to anonymous messages" },
        { status: 403 }
      );
    }

    // Allowed reply (mystery conversation)

    // Message for recipient (always anonymous)
    const replyForRecipient = {
      content,
      createdAt: new Date(),
      conversationId,
      sender: "anonymous"
    };

    // Message for current user (outgoing reply)
    const replyForCurrentUser = {
      content,
      createdAt: new Date(),
      conversationId,
      sender: "me"
    };

    // Save to recipient
    recipient.messages.push(replyForRecipient);
    await recipient.save();

    // Save to current replier (outgoing)
    const currentUser = await UserModel.findOne({ username: session.user.username });
    if (currentUser) {
      currentUser.messages.push(replyForCurrentUser);
      await currentUser.save();
    }

    return Response.json({ success: true, message: "Reply sent" });
  } catch (error) {
    console.error("Reply error:", error);
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}