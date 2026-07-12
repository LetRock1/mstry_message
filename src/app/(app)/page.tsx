'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import messages from "@/messages.json"
import Autoplay from "embla-carousel-autoplay"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useState, useEffect } from "react"

const Home = () => {
    const [mounted, setMounted] = useState(false)

useEffect(() => {
  setMounted(true)
}, [])

if (!mounted) return null

  return (
    <>
      <main className="flex-grow flex flex-col items-center justify-center px-4 md:px-24 py-16">

        <section className="text-center max-w-3xl mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Anonymous Messages. <br />
            <span className="text-primary">Real Feelings.</span> No Identity.
          </h1>

          <p className="mt-6 text-lg md:text-xl text-gray-600">
            Mystery Message lets people send you honest messages without revealing who they are.
            No profiles. No pressure. Just truth.
          </p>

          <div className="mt-8 flex gap-4 justify-center">
            <Link href="/signup">
              <Button className="px-6 py-5 text-lg">Get Started</Button>
            </Link>
            <Link href="/signin">
              <Button variant="outline" className="px-6 py-5 text-lg">
                Login
              </Button>
            </Link>
          </div>
        </section>

        <section className="mb-16 text-center text-gray-500">
          <p>🔐 Fully anonymous • ⚡ Instant delivery • 🧠 No tracking • 💬 Real conversations</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mb-20">
          {[
            {
              title: "Understand yourself",
              desc: "Take reccomendations from AI and get insights."
            },
            {
              title: "Personal Dashboard",
              desc: "Manage messages, control who can send, and moderate content."
            },
            {
              title: "Secure System",
              desc: "Auth, validation, protected APIs, and encrypted data flow."
            }
          ].map((f, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600">
                {f.desc}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="max-w-4xl text-center mb-20">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold mb-2">1. Create Account</h3>
                <p className="text-gray-600">Sign up and get your unique anonymous link.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold mb-2">2. Share Link</h3>
                <p className="text-gray-600">Share your link anywhere — social media, bio, chat.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold mb-2">3. Receive Messages</h3>
                <p className="text-gray-600">People send you messages anonymously.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="w-full flex flex-col items-center mb-20">
          <h2 className="text-3xl font-bold mb-6">Live Anonymous Messages</h2>

          <Carousel
            plugins={[Autoplay({ delay: 2500 })]}
            className="w-full max-w-sm"
          >
            <CarouselContent>
              {messages.map((message, index) => (
                <CarouselItem key={index}>
                  <div className="p-2">
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-center text-lg">
                          {message.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center justify-center p-6 min-h-[120px]">
                        <p className="text-center text-gray-700">
                          {message.content}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>

        <section className="text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Start Receiving Anonymous Messages</h2>
          <p className="text-gray-600 mb-6">
            Create your link and let people speak freely.
          </p>
          <Link href="/signup">
            <Button className="px-8 py-6 text-lg">
              Create Free Account
            </Button>
          </Link>
        </section>

      </main>

      <footer className="text-center p-6 text-gray-500 text-sm border-t">
        © 2026 Mstry Message • Built with Next.js • Secure • Anonymous • Open Platform
      </footer>
    </>
  )
}

export default Home
