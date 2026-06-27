import { Suspense } from "react"
import ResetPasswordClient from "./reset-password-client"

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading reset form...
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
