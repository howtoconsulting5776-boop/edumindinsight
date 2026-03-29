import AdminSidebar from "./AdminSidebar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "#F0EFFB" }}>
      <AdminSidebar />
      <main className="flex-1 md:ml-64 p-6 md:p-10 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
