import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";

export async function DELETE() {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ success: false }, { status: 401 });

  await UserModel.deleteOne({ username: session.user.username });
  return Response.json({ success: true });
}