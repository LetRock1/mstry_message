'use client'

import MessageCard from "@/components/MessageCard"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Message } from "@/model/User"
import { acceptMessageSchema } from "@/schemas/acceptMessageSchema"
import { ApiResponse } from "@/types/ApiResponse"
import { zodResolver } from "@hookform/resolvers/zod"
import { Separator } from "@/components/ui/separator"
import axios, { AxiosError } from "axios"
import { Loader2, RefreshCcw } from "lucide-react"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useSocket } from '@/hooks/useSocket'

type SafeMessage = Message & {
  _id?: string
  createdAt?: Date | null
}

type Conversation = {
  conversationId: string
  messages: SafeMessage[]
}

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSwitchLoading, setIsSwitchLoading] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [activeConv, setActiveConv] = useState<string | null>(null)

  // Mystery send form state
  const [targetUsername, setTargetUsername] = useState("")
  const [mysteryContent, setMysteryContent] = useState("")
  const [isSendingMystery, setIsSendingMystery] = useState(false)

  const { toast } = useToast()
  const { data: session } = useSession()
  const socket = useSocket()

  // Real-time listener
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (newMsg: any) => {
      const normalized: SafeMessage = {
        ...newMsg,
        _id: newMsg._id?.toString() || Date.now().toString(),
        conversationId: newMsg.conversationId || "default",
        sender: newMsg.sender || "anonymous",
        createdAt: newMsg.createdAt ? new Date(newMsg.createdAt) : null,
      }

      setConversations(prev => {
        const index = prev.findIndex(c => c.conversationId === normalized.conversationId)
        if (index !== -1) {
          const updated = [...prev]
          updated[index].messages.push(normalized)
          return updated
        }
        return [...prev, { conversationId: normalized.conversationId, messages: [normalized] }]
      })

      toast({ title: "New Message!", description: "Received in real-time" })
    }

    socket.on('newMessage', handleNewMessage)
    return () => socket.off('newMessage', handleNewMessage)
  }, [socket, toast])

  const handleDeleteMessage = (messageId: string) => {
    setConversations(prev =>
      prev.map(conv => ({
        ...conv,
        messages: conv.messages.filter(msg => msg._id !== messageId)
      }))
    )
  }

  const handleReplyClick = (conversationId: string) => {
    setActiveConv(conversationId)
  }

  const sendReply = async (username: string) => {
    if (!replyText.trim() || !activeConv) return

    const optimisticMsg = {
      content: replyText,
      createdAt: new Date(),
      conversationId: activeConv,
      sender: 'me',
    }

    setConversations(prev => {
      const index = prev.findIndex(c => c.conversationId === activeConv)
      if (index !== -1) {
        const updated = [...prev]
        updated[index].messages.push(optimisticMsg)
        return updated
      }
      return prev
    })

    try {
      const res = await axios.post("/api/reply", {
        username,
        content: replyText,
        conversationId: activeConv,
      })

      if (res.data.success) {
        setReplyText("")
        setActiveConv(null)
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to send reply",
        variant: "destructive"
      })
    }
  }

  const sendMysteryMessage = async () => {
    if (!targetUsername.trim() || !mysteryContent.trim()) return

    setIsSendingMystery(true)

    try {
      const res = await axios.post("/api/send-mystery", {
        recipientUsername: targetUsername,
        content: mysteryContent,
      })

      if (res.data.success) {
        toast({ title: "Sent!", description: "Mystery message delivered" })
        setTargetUsername("")
        setMysteryContent("")
        fetchMessages(true)
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to send",
        variant: "destructive"
      })
    } finally {
      setIsSendingMystery(false)
    }
  }

  const form = useForm({
    resolver: zodResolver(acceptMessageSchema),
    defaultValues: { acceptMessages: false },
  })

  const { register, watch, setValue } = form
  const acceptMessages = watch('acceptMessages')

  const fetchAcceptMessage = useCallback(async () => {
    setIsSwitchLoading(true)
    try {
      const res = await axios.get<ApiResponse>('/api/accept-messages')
      setValue('acceptMessages', res.data.isAcceptingMessages ?? false)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Failed to fetch settings",
        variant: "destructive"
      })
    } finally {
      setIsSwitchLoading(false)
    }
  }, [setValue, toast])

  const fetchMessages = useCallback(async (refresh = false) => {
    setIsLoading(true)
    try {
      const res = await axios.get<ApiResponse>('/api/get-messages')
      const raw = res.data.messages || []

      const normalized = raw.map((m: any) => ({
        ...m,
        _id: m._id?.toString(),
        conversationId: m.conversationId || "default",
        sender: m.sender || "anonymous",
        createdAt: m.createdAt ? new Date(m.createdAt) : null,
      }))

      const grouped = normalized.reduce((acc: Record<string, Conversation>, msg) => {
        const key = msg.conversationId
        if (!acc[key]) acc[key] = { conversationId: key, messages: [] }
        acc[key].messages.push(msg)
        return acc
      }, {})

      setConversations(Object.values(grouped))

      if (refresh) toast({ title: "Refreshed" })
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Failed to load",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (session?.user) {
      fetchMessages()
      fetchAcceptMessage()
    }
  }, [session, fetchMessages, fetchAcceptMessage])

  const handleSwitchChange = async () => {
    try {
      const res = await axios.post<ApiResponse>('/api/accept-messages', {
        acceptMessages: !acceptMessages
      })
      setValue('acceptMessages', !acceptMessages)
      toast({ title: res.data.message })
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Update failed",
        variant: "destructive"
      })
    }
  }

  if (!session?.user) return <div>Please login</div>

  const username = session.user.username
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const profileUrl = `${baseUrl}/u/${username}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl)
    toast({ title: "Copied", description: "Profile link copied" })
  }

  return (
    <div className="my-8 mx-4 md:mx-8 lg:mx-auto p-6 bg-white rounded w-full max-w-6xl">
      <h1 className="text-4xl font-bold mb-4">Dashboard</h1>

      {/* Profile Link */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Your Public Link</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={profileUrl}
            readOnly
            className="flex-1 p-2 border rounded bg-gray-50"
          />
          <Button onClick={copyToClipboard}>Copy</Button>
        </div>
      </div>

      {/* Send Mystery Message Form */}
      <div className="mb-8 p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Send Mystery Message</h2>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username of recipient (e.g. ret)"
            value={targetUsername}
            onChange={e => setTargetUsername(e.target.value.trim())}
            className="border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Your secret message..."
            value={mysteryContent}
            onChange={e => setMysteryContent(e.target.value)}
            rows={4}
            className="border p-3 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            onClick={sendMysteryMessage}
            disabled={isSendingMystery || !targetUsername || !mysteryContent.trim()}
            className="self-start px-6"
          >
            {isSendingMystery ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </Button>
        </div>
      </div>

      {/* Accept Toggle */}
      <div className="mb-6 flex items-center gap-3">
        <Switch
          {...register('acceptMessages')}
          checked={acceptMessages}
          onCheckedChange={handleSwitchChange}
          disabled={isSwitchLoading}
        />
        <span>Accepting messages: {acceptMessages ? 'Yes' : 'No'}</span>
      </div>

      <Separator className="my-6" />

      {/* Refresh */}
      <Button
        variant="outline"
        onClick={() => fetchMessages(true)}
        disabled={isLoading}
        className="mb-6"
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
        Refresh
      </Button>

      {/* Conversations */}
      <div className="space-y-6">
        {conversations.length > 0 ? (
          conversations.map(conv => (
            <div key={conv.conversationId} className="border p-5 rounded-lg bg-white shadow-sm">
              <h3 className="font-semibold text-lg mb-4">
                Chat {conv.conversationId.slice(-8)}
              </h3>

              {conv.messages.map(msg => (
                <MessageCard
                  key={msg._id}
                  message={msg}
                  onMessageDelete={handleDeleteMessage}
                  onReply={handleReplyClick}
                />
              ))}

              {activeConv === conv.conversationId && (
                <div className="mt-4 flex gap-3">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    onClick={() => sendReply(username)}
                    disabled={!replyText.trim()}
                  >
                    Send
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleReplyClick(conv.conversationId)}
              >
                Reply
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-gray-500">
            No chats yet. Send a mystery message above!
          </div>
        )}
      </div>
    </div>
  )
}