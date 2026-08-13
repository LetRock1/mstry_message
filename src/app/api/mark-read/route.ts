import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/options"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  // Use username to match messageWorker.ts
  const username = session.user.username
  
  if (username) {
    // Delete the exact key incremented by the worker
    await redis.del(`unread:${username}`)
  }

  return NextResponse.json({ success: true, message: "Unread counter reset" })
}