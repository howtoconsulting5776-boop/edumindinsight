export default function AdminLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="mb-10">
        <div className="h-10 w-48 rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-64 rounded-md bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-white p-7 shadow-xl shadow-slate-200/60 space-y-3">
            <div className="h-12 w-12 rounded-lg bg-slate-100" />
            <div className="h-8 w-16 rounded-md bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white p-7 shadow-xl shadow-slate-200/60 space-y-4">
        <div className="h-6 w-40 rounded-md bg-slate-200" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  )
}
