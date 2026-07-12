import { Toaster } from "@/components/ui/toaster"
import "./globals.css"
import ClientProviders from "@/providers/ClientProviders"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
          <Toaster/>
        </ClientProviders>
      </body>
    </html>
  )
}
