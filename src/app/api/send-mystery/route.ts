import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) return Response.json({ success: false }, { status: 401 });

    const { recipientUsername, content } = await req.json();
    const conversationId = Date.now().toString();

    const recipient = await UserModel.findOne({ username: recipientUsername });
    if (!recipient) return Response.json({ success: false, message: "User not found" }, { status: 404 });

    // To recipient: always anonymous
    recipient.messages.push({
      content,
      createdAt: new Date(),
      conversationId,
      sender: "anonymous"
    });
    await recipient.save();

    // To sender: "me"
    const senderUser = await UserModel.findOne({ username: session.user.username });
    if (senderUser) {
      senderUser.messages.push({
        content,
        createdAt: new Date(),
        conversationId,
        sender: "me"
      });
      await senderUser.save();
    }

    return Response.json({ success: true, conversationId });
  } catch (e) {
    return Response.json({ success: false }, { status: 500 });
  }
}