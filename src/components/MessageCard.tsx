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
import { X } from "lucide-react"
import { Message } from "@/model/User"
import { useToast } from "@/hooks/use-toast"
import { ApiResponse } from "@/types/ApiResponse"
import axios from "axios"

type MessageCardProps = {
  message: Message & { _id?: string }
  onMessageDelete: (messageId: string) => void
  onReply: (conversationId: string) => void
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

  const isAnonymous = message.sender === "anonymous"

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Message</CardTitle>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <X className="w-5 h-5" />
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the message.
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

      <CardContent>
        <p className="font-medium">
          {message.content || "No message content"}
        </p>

        <p className="text-xs text-gray-400 mt-1">
          Sender: {message.sender || "anonymous"}
        </p>
      </CardContent>

      <CardDescription className="px-6 pb-4 text-sm text-gray-500">
        {formattedDate}
      </CardDescription>

      {/* ✅ ONLY SHOW REPLY IF NOT ANONYMOUS */}
      {!isAnonymous && message.conversationId && (
        <div className="px-6 pb-4">
          <Button onClick={() => onReply(message.conversationId!)}>
            Reply
          </Button>
        </div>
      )}
    </Card>
  )
}

export default MessageCard