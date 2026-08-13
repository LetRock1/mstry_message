import { NextRequest } from "next/server";
import { checkRateLimit, isUserAcceptingMessages } from "@/lib/redisHelpers";
import { messageQueue } from "@/lib/queue";

export async function POST(request: NextRequest) {
  try {
    // 1. Extract IP address & enforce Redis Rate Limiting (5 msgs per 60s per IP)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = await checkRateLimit(ip, 5, 60);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          message: "Too many requests. Please wait a minute before sending another message.",
        },
        { status: 429 }
      );
    }

    // 2. Parse payload
    const { username, content } = await request.json();

    if (!username || !content) {
      return Response.json(
        { success: false, message: "Recipient username and content are required" },
        { status: 400 }
      );
    }

    // 3. Fast Acceptance Check via Redis RAM Cache (~1ms, skips MongoDB)
    const isAccepting = await isUserAcceptingMessages(username);
    if (!isAccepting) {
      return Response.json(
        { success: false, message: "User is currently not accepting messages" },
        { status: 403 }
      );
    }

    // 4. Dispatch job to BullMQ Queue (Asynchronous processing)
    await messageQueue.add("guest-message", {
      type: "GUEST_MESSAGE",
      recipientUsername: username,
      content,
      createdAt: new Date(),
    });

    // 5. Respond instantly (201 Created)
    return Response.json(
      { success: true, message: "Message sent successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error sending message:", error);
    return Response.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}