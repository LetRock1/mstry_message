'use client'

import MessageCard from "@/components/MessageCard"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Message } from "@/model/User"
import { ApiResponse } from "@/types/ApiResponse"
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
  UserCircle2, Ban, Trash2, X, Circle, Check, XCircle
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useRef, useState } from "react"
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
  const [acceptMessages, setAcceptMessages] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [targetUsername, setTargetUsername] = useState("")
  const [mysteryContent, setMysteryContent] = useState("")
  const [isSendingMystery, setIsSendingMystery] = useState(false)

  const { toast } = useToast()
  const { data: session, update: updateSession } = useSession()
  const socket = useSocket()

  const hasFetchedInitial = useRef(false)

  const fetchBlockedUsers = async () => {
    try {
      const res = await axios.get("/api/block")
      if (res.data.success) setBlockedUsers(res.data.blockedUsers || [])
    } catch (e) {}
  }
  useEffect(() => { fetchBlockedUsers() }, [])

  const handleUnblock = async (target: string) => {
    try {
      await axios.post("/api/block", { targetUsername: target, action: "unblock" })
      setBlockedUsers(prev => prev.filter(u => u !== target))
      toast({ title: `Unblocked @${target}` })
      fetchMessages()
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await axios.delete(`/api/delete-conversation?conversationId=${conversationId}`)
      setConversations(prev => prev.filter(c => c.conversationId !== conversationId))
      toast({ title: "Conversation deleted" })
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  const handleDeleteSingleMessage = async (messageId: string) => {
    try {
      await axios.delete(`/api/delete-message/${messageId}`)
      setConversations(prev =>
        prev.map(conv => ({
          ...conv,
          messages: conv.messages.filter(m => m._id !== messageId),
        })).filter(conv => conv.messages.length > 0)
      )
      setGuestMessages(prev => prev.filter(m => m._id !== messageId))
      toast({ title: "Message deleted" })
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete", variant: "destructive" })
    }
  }

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

  const handleReplyClick = (conversationId: string) => {
    setActiveConv(prev => (prev === conversationId ? null : conversationId))
  }

  const sendReply = async (convId: string, otherUsername?: string) => {
    if (!replyText.trim() || !convId) return

    const optimisticMsg: SafeMessage = {
      _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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

  const handleBlock = async (target: string) => {
    try {
      const res = await axios.post("/api/block", { targetUsername: target, action: "block" })
      if (res.data.success) {
        setBlockedUsers(prev => [...prev, target])
        setConversations(prev => prev.filter(conv => conv.otherUsername !== target))
        toast({ title: `Blocked @${target}` })
      }
    } catch (err: any) {
      toast({ title: "Block failed", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await axios.delete("/api/user/delete")
      toast({ title: "Account deleted" })
      window.location.href = "/"
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.response?.data?.message || "", variant: "destructive" })
    }
  }

  const fetchAcceptMessage = useCallback(async () => {
    setIsSwitchLoading(true)
    try {
      const res = await axios.get<ApiResponse>("/api/accept-messages")
      const isAccepting = res.data.isAcceptingMessages ?? res.data.isAcceptingMessage ?? false;
      setAcceptMessages(isAccepting)
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
  }, [toast])

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
    if (session?.user && !hasFetchedInitial.current) {
      hasFetchedInitial.current = true
      fetchMessages()
      fetchAcceptMessage()
    }
  }, [session, fetchMessages, fetchAcceptMessage])

  const handleToggleAccept = async () => {
    const nextStatus = !acceptMessages;
    setIsSwitchLoading(true);
    try {
      const res = await axios.post<ApiResponse>("/api/accept-messages", {
        acceptMessages: nextStatus,
      });
      setAcceptMessages(nextStatus);
      await updateSession({ isAcceptingMessage: nextStatus });
      toast({ title: res.data.message });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse>;
      toast({
        title: "Error",
        description: axiosErr.response?.data.message || "Update failed",
        variant: "destructive",
      });
    } finally {
      setIsSwitchLoading(false);
    }
  };

  if (!session?.user) return <div className="p-8 text-center">Please login</div>

  const username = session.user.username
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const profileUrl = `${baseUrl}/u/${username}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl)
    toast({ title: "Copied", description: "Profile link copied to clipboard" })
  }

  const visibleConversations = conversations.filter(
    conv => !conv.otherUsername || !blockedUsers.includes(conv.otherUsername)
  )

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-lg border p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <Button variant="outline" size="sm" onClick={() => fetchMessages(true)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Public Link */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-600 mb-2">Your Public Link</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={profileUrl}
              readOnly
              className="flex-1 p-2 border rounded-lg bg-gray-50 text-sm text-gray-700 min-w-0"
            />
            <Button onClick={copyToClipboard} size="sm" className="shrink-0">Copy Link</Button>
          </div>
        </div>

        {/* Send Mystery Message */}
        <div className="mb-8 p-4 sm:p-5 border rounded-xl bg-slate-50/50">
          <h2 className="text-base sm:text-lg font-semibold mb-1 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" />
            Send Mystery Message
          </h2>
          <p className="text-xs text-gray-500 mb-3">Start a private 2-way anonymous chat thread with any registered user.</p>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Recipient's username"
              value={targetUsername}
              onChange={e => setTargetUsername(e.target.value.trim())}
              className="border p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
            <textarea
              placeholder="Type your secret message..."
              value={mysteryContent}
              onChange={e => setMysteryContent(e.target.value)}
              rows={2}
              className="border p-2.5 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
            <Button
              onClick={sendMysteryMessage}
              disabled={isSendingMystery || !targetUsername || !mysteryContent.trim()}
              className="self-start px-5"
              size="sm"
            >
              {isSendingMystery ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Message"}
            </Button>
          </div>
        </div>

        {/* Accept Messages Toggle Button */}
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleToggleAccept}
            disabled={isSwitchLoading}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              acceptMessages
                ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                : 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
            }`}
          >
            {acceptMessages ? (
              <>
                <Check className="w-4 h-4" /> Accepting: ON
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" /> Accepting: OFF
              </>
            )}
          </button>
          <span className="text-sm text-gray-500">
            Toggle to allow public messages
          </span>
        </div>

        {/* Blocked Users */}
        {blockedUsers.length > 0 && (
          <div className="mb-6 border rounded-xl p-4 bg-red-50">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Blocked Users</h3>
            <div className="flex flex-wrap gap-2">
              {blockedUsers.map(u => (
                <span key={u} className="bg-white border rounded-full px-3 py-1 text-sm flex items-center gap-2">
                  @{u}
                  <button onClick={() => handleUnblock(u)} className="text-red-500 hover:text-red-700">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-6" />

        {/* Tabs */}
        <Tabs defaultValue="guest" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="guest" className="flex items-center justify-center gap-2 text-xs sm:text-sm">
              <MessageSquare className="w-4 h-4" /> Guest Messages
              <span className="ml-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-800 rounded-full font-bold">
                {guestMessages.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="chats" className="flex items-center justify-center gap-2 text-xs sm:text-sm">
              <MessagesSquare className="w-4 h-4 text-blue-600" /> 2-Way Chats
              <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-bold">
                {visibleConversations.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guest">
            {guestMessages.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {guestMessages.map(msg => (
                  <MessageCard
                    key={msg._id}
                    message={msg}
                    onMessageDelete={handleDeleteSingleMessage}
                  />
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
                    {/* Chat Header */}
                    <div className="bg-slate-100 px-4 py-3 border-b flex flex-col sm:flex-row justify-between gap-2 sm:items-center">
                      <div className="flex items-center gap-3">
                        <UserCircle2 className="w-8 h-8 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm text-gray-800 truncate">
                            {conv.otherUsername ? `Chat with @${conv.otherUsername}` : "Anonymous Conversation"}
                          </h3>
                          {conv.otherUsername && <OnlineStatusIndicator username={conv.otherUsername} />}
                          <p className="text-xs text-gray-500 font-mono">ID: #{conv.conversationId.slice(-8)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2 flex-wrap">
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

                    {/* Messages */}
                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                      {conv.messages.map(msg => {
                        const isMe = msg.sender === session?.user?.username || msg.sender === "me"
                        return (
                          <div key={msg._id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} relative group`}>
                            <div className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[70%] text-sm shadow-sm ${
                              isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-gray-800 border rounded-bl-none"
                            }`}>
                              <p className="break-words">{msg.content}</p>
                              <span className={`block text-[10px] mt-1 text-right ${isMe ? "text-blue-200" : "text-gray-400"}`}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteSingleMessage(msg._id!)}
                              className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Reply Input */}
                    {activeConv === conv.conversationId && (
                      <div className="p-3 bg-white border-t flex gap-2">
                        <input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          onKeyDown={e => e.key === "Enter" && sendReply(conv.conversationId, conv.otherUsername)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                        />
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
              <Button variant="destructive" size="sm" className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
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
    </div>
  )
}