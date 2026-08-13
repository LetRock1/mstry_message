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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import axios, { AxiosError } from "axios"
import {
  Loader2, RefreshCcw, Send, MessageSquare, MessagesSquare,
  UserCircle2, Ban, Trash2, X, Circle
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useSocket } from "@/hooks/useSocket"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

type SafeMessage = Message & {
  _id?: string
  createdAt?: Date | null
  conversationId?: string
  sender?: string
  recipientUsername?: string
  senderUsername?: string
}

type Conversation = {
  conversationId: string
  messages: SafeMessage[]
  otherUsername?: string
}

// ✅ Move component outside to avoid re-creation and hydration mismatch
function OnlineStatusIndicator({ username }: { username: string }) {
  const { online, lastSeen } = useOnlineStatus(username)
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <Circle
        className={`w-2 h-2 ${
          online ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'
        }`}
      />
      {online
        ? 'Online'
        : lastSeen
        ? `Last seen ${new Date(lastSeen).toLocaleString()}`
        : 'Offline'}
    </span>
  )
}

export default function Page() {
  const [guestMessages, setGuestMessages] = useState<SafeMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [isSwitchLoading, setIsSwitchLoading] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [targetUsername, setTargetUsername] = useState("")
  const [mysteryContent, setMysteryContent] = useState("")
  const [isSendingMystery, setIsSendingMystery] = useState(false)

  const { toast } = useToast()
  const { data: session, update: updateSession } = useSession()
  const socket = useSocket()

  // --- Fetch blocked users ---
  const fetchBlockedUsers = async () => {
    try {
      const res = await axios.get("/api/block")
      if (res.data.success) setBlockedUsers(res.data.blockedUsers || [])
    } catch (e) {}
  }
  useEffect(() => { fetchBlockedUsers() }, [])

  // --- Unblock user and refresh conversations ---
  const handleUnblock = async (target: string) => {
    try {
      await axios.post("/api/block", { targetUsername: target, action: "unblock" })
      setBlockedUsers(prev => prev.filter(u => u !== target))
      toast({ title: `Unblocked @${target}` })
      // Reload messages so the thread reappears
      fetchMessages()
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  // --- Delete conversation ---
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await axios.delete(`/api/delete-conversation?conversationId=${conversationId}`)
      setConversations(prev => prev.filter(c => c.conversationId !== conversationId))
      toast({ title: "Conversation deleted" })
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  // --- Real-Time Socket Listener ---
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (newMsg: any) => {
      const normalized: SafeMessage = {
        ...newMsg,
        _id: newMsg._id?.toString() || Date.now().toString(),
        conversationId: newMsg.conversationId,
        sender: newMsg.sender || "anonymous",
        createdAt: newMsg.createdAt ? new Date(newMsg.createdAt) : new Date(),
        recipientUsername: newMsg.recipientUsername,
        senderUsername: newMsg.senderUsername,
      }

      if (!normalized.conversationId) {
        setGuestMessages(prev => [normalized, ...prev])
      } else {
        setConversations(prev => {
          const index = prev.findIndex(c => c.conversationId === normalized.conversationId)
          if (index !== -1) {
            const updated = [...prev]
            updated[index].messages.push(normalized)
            return updated
          }
          const other = normalized.sender === "anonymous" ? normalized.senderUsername : normalized.recipientUsername
          return [...prev, { conversationId: normalized.conversationId!, messages: [normalized], otherUsername: other }]
        })
      }

      toast({ title: "New Message!", description: "Received in real-time" })
    }

    socket.on("newMessage", handleNewMessage)
    return () => { socket.off("newMessage", handleNewMessage) }
  }, [socket, toast])

  // --- Delete single message ---
  const handleDeleteMessage = (messageId: string) => {
    setGuestMessages(prev => prev.filter(msg => msg._id !== messageId))
    setConversations(prev =>
      prev.map(conv => ({
        ...conv,
        messages: conv.messages.filter(msg => msg._id !== messageId),
      })).filter(conv => conv.messages.length > 0)
    )
  }

  const handleReplyClick = (conversationId: string) => {
    setActiveConv(prev => (prev === conversationId ? null : conversationId))
  }

  // --- Reply (sends otherUsername if known) ---
  const sendReply = async (convId: string, otherUsername?: string) => {
    if (!replyText.trim() || !convId) return

    const optimisticMsg: SafeMessage = {
      _id: Date.now().toString(),
      content: replyText,
      createdAt: new Date(),
      conversationId: convId,
      sender: "me",
      recipientUsername: otherUsername,
    }

    setConversations(prev =>
      prev.map(c =>
        c.conversationId === convId
          ? { ...c, messages: [...c.messages, optimisticMsg] }
          : c
      )
    )

    const textToSend = replyText
    setReplyText("")

    try {
      const res = await axios.post("/api/reply", {
        content: textToSend,
        conversationId: convId,
        recipientUsername: otherUsername,
      })
      if (res.data.success) toast({ title: "Reply sent!" })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to send reply",
        variant: "destructive",
      })
    }
  }

  // --- Send Mystery Message ---
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
        fetchMessages()
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to send",
        variant: "destructive",
      })
    } finally {
      setIsSendingMystery(false)
    }
  }

  // --- Block a user ---
  const handleBlock = async (target: string) => {
    try {
      const res = await axios.post("/api/block", { targetUsername: target, action: "block" })
      if (res.data.success) {
        setBlockedUsers(prev => [...prev, target])
        // Immediately filter out conversations with this user
        setConversations(prev => prev.filter(conv => conv.otherUsername !== target))
        toast({ title: `Blocked @${target}` })
      }
    } catch (err: any) {
      toast({ title: "Block failed", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  // --- Delete Account ---
  const handleDeleteAccount = async () => {
    try {
      await axios.delete("/api/user/delete")
      toast({ title: "Account deleted" })
      window.location.href = "/"
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  const form = useForm({
    resolver: zodResolver(acceptMessageSchema),
    defaultValues: { acceptMessages: false },
  })

  const { register, watch, setValue } = form
  const acceptMessages = watch("acceptMessages")

  const fetchAcceptMessage = useCallback(async () => {
    setIsSwitchLoading(true)
    try {
      const res = await axios.get<ApiResponse>("/api/accept-messages")
      setValue("acceptMessages", res.data.isAcceptingMessages ?? false)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Failed to fetch settings",
        variant: "destructive",
      })
    } finally {
      setIsSwitchLoading(false)
    }
  }, [setValue, toast])

  const fetchMessages = useCallback(async (refresh = false) => {
    setIsLoading(true)
    try {
      const res = await axios.get<ApiResponse>("/api/get-messages")
      const raw = res.data.messages || []

      const normalized: SafeMessage[] = raw.map((m: any) => ({
        ...m,
        _id: m._id?.toString(),
        conversationId: m.conversationId || undefined,
        sender: m.sender || "anonymous",
        createdAt: m.createdAt ? new Date(m.createdAt) : null,
        recipientUsername: m.recipientUsername || undefined,
        senderUsername: m.senderUsername || undefined,
      }))

      const guests = normalized.filter(m => !m.conversationId)
      const threaded = normalized.filter(m => Boolean(m.conversationId))

      const grouped: Record<string, Conversation> = {}
      threaded.forEach(msg => {
        const key = msg.conversationId!
        if (!grouped[key]) {
          let other: string | undefined
          if (msg.sender === "me" && msg.recipientUsername) other = msg.recipientUsername
          else if (msg.sender === "anonymous" && msg.senderUsername) other = msg.senderUsername
          grouped[key] = { conversationId: key, messages: [], otherUsername: other }
        }
        grouped[key].messages.push(msg)
      })

      setGuestMessages(guests)
      setConversations(Object.values(grouped))

      if (refresh) toast({ title: "Refreshed" })
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Failed to load messages",
        variant: "destructive",
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
    const nextStatus = !acceptMessages
    try {
      const res = await axios.post<ApiResponse>("/api/accept-messages", {
        acceptMessages: nextStatus,
      })
      setValue("acceptMessages", nextStatus)
      await updateSession({ isAcceptingMessage: nextStatus })
      toast({ title: res.data.message })
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Update failed",
        variant: "destructive",
      })
    }
  }

  if (!session?.user) return <div className="p-8 text-center">Please login</div>

  const username = session.user.username
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const profileUrl = `${baseUrl}/u/${username}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl)
    toast({ title: "Copied", description: "Profile link copied to clipboard" })
  }

  // Filter conversations based on blockedUsers (for display)
  const visibleConversations = conversations.filter(
    conv => !conv.otherUsername || !blockedUsers.includes(conv.otherUsername)
  )

  return (
    <div className="my-8 mx-4 md:mx-8 lg:mx-auto p-6 bg-white rounded-xl w-full max-w-6xl shadow-sm border">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => fetchMessages(true)} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Public Link */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-600 mb-2">Your Public Link</h2>
        <div className="flex items-center gap-2">
          <input type="text" value={profileUrl} readOnly className="flex-1 p-2 border rounded-md bg-gray-50 text-sm text-gray-700" />
          <Button onClick={copyToClipboard} size="sm">Copy Link</Button>
        </div>
      </div>

      {/* Send Mystery Message */}
      <div className="mb-8 p-5 border rounded-lg bg-slate-50/50">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-600" />
          Send Mystery Message
        </h2>
        <p className="text-xs text-gray-500 mb-3">Start a private 2-way anonymous chat thread with any registered user.</p>
        <div className="flex flex-col gap-3">
          <input type="text" placeholder="Recipient's username" value={targetUsername}
            onChange={e => setTargetUsername(e.target.value.trim())}
            className="border p-2.5 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea placeholder="Type your secret message..." value={mysteryContent}
            onChange={e => setMysteryContent(e.target.value)} rows={2}
            className="border p-2.5 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Button onClick={sendMysteryMessage} disabled={isSendingMystery || !targetUsername || !mysteryContent.trim()}
            className="self-start px-5" size="sm">
            {isSendingMystery ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Message"}
          </Button>
        </div>
      </div>

      {/* Accept Messages Toggle */}
      <div className="mb-6 flex items-center gap-3">
        <Switch {...register("acceptMessages")} checked={acceptMessages} onCheckedChange={handleSwitchChange} disabled={isSwitchLoading} />
        <span className="font-medium text-sm">
          Accepting public messages: <strong className={acceptMessages ? "text-green-600" : "text-red-500"}>{acceptMessages ? "Yes" : "No"}</strong>
        </span>
      </div>

      {/* Blocked Users */}
      {blockedUsers.length > 0 && (
        <div className="mb-6 border rounded-lg p-4 bg-red-50">
          <h3 className="font-semibold mb-2">Blocked Users</h3>
          <div className="flex flex-wrap gap-2">
            {blockedUsers.map(u => (
              <span key={u} className="bg-white border rounded-full px-3 py-1 text-sm flex items-center gap-2">
                @{u}
                <button onClick={() => handleUnblock(u)} className="text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      <Separator className="my-6" />

      {/* Tabs */}
      <Tabs defaultValue="guest" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="guest" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Guest Messages
            <span className="ml-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-800 rounded-full font-bold">{guestMessages.length}</span>
          </TabsTrigger>
          <TabsTrigger value="chats" className="flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-blue-600" /> 2-Way Anonymous Chats
            <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-bold">{visibleConversations.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guest">
          {guestMessages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guestMessages.map(msg => (
                <MessageCard key={msg._id} message={msg} onMessageDelete={handleDeleteMessage} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg bg-gray-50">
              <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No public guest messages yet.</p>
              <p className="text-xs text-gray-400 mt-1">Share your link to start receiving anonymous messages.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chats">
          {visibleConversations.length > 0 ? (
            <div className="space-y-6">
              {visibleConversations.map(conv => (
                <div key={conv.conversationId} className="border rounded-xl bg-slate-50/50 shadow-sm overflow-hidden">
                  <div className="bg-slate-100 px-4 py-3 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <UserCircle2 className="w-8 h-8 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-sm text-gray-800">
                          {conv.otherUsername ? `Chat with @${conv.otherUsername}` : "Anonymous Conversation"}
                        </h3>
                        {conv.otherUsername && <OnlineStatusIndicator username={conv.otherUsername} />}
                        <p className="text-xs text-gray-500 font-mono">ID: #{conv.conversationId.slice(-8)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {conv.otherUsername && (
                        <>
                          <Button size="sm" variant="ghost" className="text-xs text-red-500 hover:text-red-700"
                            onClick={() => handleBlock(conv.otherUsername!)}>
                            <Ban className="w-4 h-4 mr-1" /> Block
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteConversation(conv.conversationId)}>
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => handleReplyClick(conv.conversationId)}>
                        {activeConv === conv.conversationId ? "Hide Chat Box" : "Open Chat Box"}
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {conv.messages.map(msg => {
                      const isMe = msg.sender === session?.user?.username || msg.sender === "me"
                      return (
                        <div key={msg._id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div className={`p-3 rounded-2xl max-w-[80%] text-sm shadow-sm ${
                            isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-gray-800 border rounded-bl-none"}`}>
                            <p>{msg.content}</p>
                            <span className={`block text-[10px] mt-1 text-right ${isMe ? "text-blue-200" : "text-gray-400"}`}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {activeConv === conv.conversationId && (
                    <div className="p-3 bg-white border-t flex gap-2">
                      <input value={replyText} onChange={e => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        onKeyDown={e => e.key === "Enter" && sendReply(conv.conversationId, conv.otherUsername)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <Button onClick={() => sendReply(conv.conversationId, conv.otherUsername)} disabled={!replyText.trim()} size="sm">
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg bg-gray-50">
              <MessagesSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No active 2-way anonymous chats.</p>
              <p className="text-xs text-gray-400 mt-1">Send a mystery message above to start a thread.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Account */}
      <div className="mt-8 border-t pt-4 flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove your profile and all messages.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}