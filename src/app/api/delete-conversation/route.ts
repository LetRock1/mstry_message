import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    if (!conversationId) {
      return Response.json({ success: false, message: "conversationId required" }, { status: 400 });
    }

    // Remove all messages with that conversationId from current user
    await UserModel.updateOne(
      { username: session.user.username },
      { $pull: { messages: { conversationId } } }
    );

    // Also remove from the other participant if known (optional)
    // To do that, we need to know the other user; we can query the current user's messages.
    const currentUser = await UserModel.findOne({ username: session.user.username });
    if (!currentUser) return Response.json({ success: false, message: "User not found" }, { status: 404 });

    // Find the other participant's username from a message where sender is "me" and recipientUsername is stored
    const ourMsg = currentUser.messages.find(
      (m: any) => m.conversationId === conversationId && m.recipientUsername
    );
    if (ourMsg && ourMsg.recipientUsername) {
      // Remove from recipient's messages
      await UserModel.updateOne(
        { username: ourMsg.recipientUsername },
        { $pull: { messages: { conversationId } } }
      );
    }

    return Response.json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}