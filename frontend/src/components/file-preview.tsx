"use client"

import { useEffect, useState } from "react"
import { Download, Eye, ExternalLink, FileText, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

export interface PreviewFile {
  id: number
  file_name: string
  mime_type: string
  size_bytes: number
}

export function isPreviewable(mime: string, name: string) {
  const lower = name.toLowerCase()
  return (
    mime === "application/pdf" ||
    lower.endsWith(".pdf") ||
    mime.startsWith("image/")
  )
}

function isPdf(mime: string, name: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Controlled, standalone preview modal. Pass the `file` to preview (or null
 * to close). `loadUrl` fetches the file as an authenticated object URL.
 * Use this when the surrounding list already has its own row layout.
 */
export function FilePreviewModal({
  file,
  loadUrl,
  onClose,
}: {
  file: PreviewFile | null
  loadUrl: (file: PreviewFile) => Promise<string>
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    let active = true
    let created: string | null = null
    setUrl(null)
    setError(null)
    setLoading(true)
    loadUrl(file)
      .then((next) => {
        if (!active) {
          URL.revokeObjectURL(next)
          return
        }
        created = next
        setUrl(next)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load file")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [file, loadUrl])

  const pdf = file ? isPdf(file.mime_type, file.file_name) : false

  const download = () => {
    if (!url || !file) return
    const a = document.createElement("a")
    a.href = url
    a.download = file.file_name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        onClose={onClose}
        className="flex h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <DialogTitle className="truncate text-[14px] font-semibold text-slate-800">
            {file?.file_name}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-[7px] border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            )}
            <button
              onClick={download}
              className="flex h-8 items-center gap-1.5 rounded-[7px] border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-[7px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative flex-1 bg-slate-100">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
              {error}
            </div>
          ) : url ? (
            pdf ? (
              <iframe title={file?.file_name} src={url} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={file?.file_name} className="max-h-full max-w-full object-contain" />
              </div>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Renders an attachment row with a Preview (PDF/image, opens in-app modal)
 * and a Download action. `loadUrl` fetches the file as an authenticated
 * object URL.
 */
export function FilePreview({
  file,
  loadUrl,
}: {
  file: PreviewFile
  loadUrl: (file: PreviewFile) => Promise<string>
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewable = isPreviewable(file.mime_type, file.file_name)
  const pdf = isPdf(file.mime_type, file.file_name)

  // Revoke the object URL when the modal closes / component unmounts.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  const ensureUrl = async (): Promise<string | null> => {
    if (url) return url
    setLoading(true)
    setError(null)
    try {
      const next = await loadUrl(file)
      setUrl(next)
      return next
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file")
      return null
    } finally {
      setLoading(false)
    }
  }

  const openPreview = async () => {
    setOpen(true)
    await ensureUrl()
  }

  const download = async () => {
    const next = await ensureUrl()
    if (!next) return
    const a = document.createElement("a")
    a.href = next
    a.download = file.file_name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <>
      <div className="flex items-center gap-3 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-slate-100">
          <FileText className="h-5 w-5 text-slate-400" />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-[13px] font-medium text-slate-700">{file.file_name}</p>
          <p className="text-[11px] text-slate-400">{formatSize(file.size_bytes)}</p>
        </div>
        <div className="mr-2 flex items-center gap-1">
          {previewable && (
            <button
              onClick={openPreview}
              title="Preview"
              className="flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
            >
              <Eye className="h-4 w-4" /> Preview
            </button>
          )}
          <button
            onClick={download}
            title="Download"
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          onClose={() => setOpen(false)}
          className="flex h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <DialogTitle className="truncate text-[14px] font-semibold text-slate-800">
              {file.file_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 items-center gap-1.5 rounded-[7px] border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              )}
              <button
                onClick={download}
                className="flex h-8 items-center gap-1.5 rounded-[7px] border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-[7px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 bg-slate-100">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
                {error}
              </div>
            ) : url ? (
              pdf ? (
                <iframe
                  title={file.file_name}
                  src={url}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={file.file_name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
