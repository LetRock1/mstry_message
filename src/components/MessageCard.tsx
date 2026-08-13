'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogHeader
} from "@/components/ui/alert-dialog"

import { Button } from "@/components/ui/button"
import { X, MessageSquareReply } from "lucide-react"
import { Message } from "@/model/User"
import { useToast } from "@/hooks/use-toast"
import { ApiResponse } from "@/types/ApiResponse"
import axios from "axios"

type MessageCardProps = {
  message: Message & { _id?: string; conversationId?: string; sender?: string }
  onMessageDelete: (messageId: string) => void
  onReply?: (conversationId: string) => void
}

const MessageCard = ({ message, onMessageDelete, onReply }: MessageCardProps) => {
  const { toast } = useToast()

  const handleDeleteConfirm = async () => {
    try {
      if (!message._id) return

      const response = await axios.delete<ApiResponse>(
        `/api/delete-message/${message._id}`
      )

      toast({ title: response.data.message })
      onMessageDelete(message._id)
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error?.response?.data?.message || "Something went wrong",
        variant: "destructive"
      })
    }
  }

  const formattedDate = message.createdAt
    ? new Date(message.createdAt).toLocaleString()
    : "No date"

  // ⚡ FIX: Treat undefined, null, "anonymous", or "guest" as anonymous
  const isAnonymous =
    !message.sender ||
    message.sender === "anonymous" ||
    message.sender === "guest"

  // A message can only be replied to if it is NOT anonymous AND has a valid conversationId
  const canReply = !isAnonymous && Boolean(message.conversationId)

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row justify-between items-center pb-2">
        <CardTitle className="text-base font-semibold">
          {isAnonymous ? "Guest Message" : `From: ${message.sender}`}
        </CardTitle>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the message.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      <CardContent className="pt-2">
        <p className="font-medium text-gray-800">
          {message.content || "No message content"}
        </p>
      </CardContent>

      <CardDescription className="px-6 pb-4 text-xs text-gray-400">
        Received: {formattedDate}
      </CardDescription>

      {/* ONLY SHOW REPLY BUTTON IF IT IS A TWO-WAY CONVERSATION */}
      {canReply && onReply && (
        <div className="px-6 pb-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReply(message.conversationId!)}
            className="flex items-center gap-2"
          >
            <MessageSquareReply className="w-4 h-4" />
            Reply
          </Button>
        </div>
      )}
    </Card>
  )
}

export default MessageCard