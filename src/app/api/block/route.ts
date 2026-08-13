import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";

// POST: block or unblock a user
export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { targetUsername, action } = await req.json();
    if (!targetUsername || !["block", "unblock"].includes(action)) {
      return Response.json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    const updateQuery =
      action === "block"
        ? { $addToSet: { blockedUsers: targetUsername } }
        : { $pull: { blockedUsers: targetUsername } };

    await UserModel.updateOne(
      { username: session.user.username },
      updateQuery
    );

    return Response.json({
      success: true,
      message: `User ${action === "block" ? "blocked" : "unblocked"} successfully`,
    });
  } catch (error) {
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// GET: list all blocked users
export async function GET() {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await UserModel.findOne({ username: session.user.username }).select("blockedUsers");
    if (!user) return Response.json({ success: false, message: "User not found" }, { status: 404 });

    return Response.json({ success: true, blockedUsers: user.blockedUsers || [] });
  } catch (error) {
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  }
}