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

    // ✅ Remove all messages with this conversationId from the CURRENT USER ONLY
    await UserModel.updateOne(
      { username: session.user.username },
      { $pull: { messages: { conversationId } } }
    );

    return Response.json({ success: true, message: "Conversation deleted for you" });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}