import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { User } from "next-auth";
import { redis } from "@/lib/redis";

export async function POST(request: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions);

  const user: User = session?.user as User;

  if (!session || !session.user) {
    return Response.json(
      {
        success: false,
        message: "Not Authenticated",
      },
      { status: 401 }
    );
  }

  const userid = user._id;
  const { acceptMessages } = await request.json();

  try {
    const updatedUser = await UserModel.findByIdAndUpdate(
      userid,
      { isAcceptingMessage: acceptMessages },
      { new: true }
    );

    if (!updatedUser) {
      return Response.json(
        {
          success: false,
          message: "Failed to update user status to accept messages",
        },
        { status: 404 }
      );
    }

    // 🔥 FORCE REDIS CACHE RESET – ensures toggle is immediate
    await redis.del(`user:${updatedUser.username}:accepting`);
    await redis.set(
      `user:${updatedUser.username}:accepting`,
      acceptMessages ? "true" : "false"
    );

    return Response.json(
      {
        success: true,
        message: "Message acceptance status updated successfully",
        isAcceptingMessage: updatedUser.isAcceptingMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update user status to accept messages:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to update user status to accept messages",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  const user: User = session?.user as User;

  if (!session || !session.user) {
    return Response.json(
      {
        success: false,
        message: "Not Authenticated",
      },
      { status: 401 }
    );
  }

  const userid = user._id;

  try {
    const foundUser = await UserModel.findById(userid);

    if (!foundUser) {
      return Response.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }

    // Refresh Redis cache on GET
    await redis.del(`user:${foundUser.username}:accepting`);
    await redis.set(
      `user:${foundUser.username}:accepting`,
      foundUser.isAcceptingMessage ? "true" : "false"
    );

    return Response.json(
      {
        success: true,
        isAcceptingMessage: foundUser.isAcceptingMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching message acceptance status:", error);

    return Response.json(
      {
        success: false,
        message: "Error getting message acceptance status",
      },
      { status: 500 }
    );
  }
}