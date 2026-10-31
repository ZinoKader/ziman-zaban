import { Copy, Download, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { dayKey } from '@/store/progress'
import {
  buildExport,
  downloadReviewFile,
  exportFileName,
  parseReviewFile,
  serializeExport,
  type ReviewFile,
} from './export'
import { useReview } from './store'
import { reviewStrings } from './strings'

function downloadToday(lang: TargetLang, reviewer: string, file: ReviewFile) {
  downloadReviewFile(exportFileName(lang, reviewer, dayKey(new Date())), file)
}

export function ExportPanel({ lang }: { lang: TargetLang }) {
  const s = reviewStrings.use()
  const c = common.use()
  const decisions = useReview((st) => st.decisions)
  const reviewer = useReview((st) => st.reviewer)
  const importReviews = useReview((st) => st.importReviews)
  const clear = useReview((st) => st.clear)
  const fileInput = useRef<HTMLInputElement>(null)
  const file = buildExport(decisions, lang)
  const n = file.reviews.length

  const download = () => {
    downloadToday(lang, reviewer, file)
    toast.success(s.downloaded)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serializeExport(file))
      toast.success(s.copied)
    } catch {
      toast.error(s.copyFailed)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{s.exportHint}</p>
      <div className="grid gap-2">
        <Button
          size="xl"
          disabled={!n}
          onClick={download}
        >
          <Download /> {n ? s.download(n) : s.nothingYet}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={!n} onClick={() => void copy()}>
            <Copy /> {s.copy}
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload /> {s.import}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="review-import"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const parsed = parseReviewFile(await f.text())
            if (!parsed) return void toast.error(s.importFailed)
            toast.success(s.imported(importReviews(parsed.reviews)))
          }}
        />
        {n > 0 && (
          <Button
            variant="ghost"
            className="justify-self-start text-destructive"
            onClick={() => {
              if (!confirm(s.clearConfirm(c.languagesShort[lang]))) return
              clear(lang)
              toast.success(s.cleared)
            }}
          >
            <Trash2 /> {s.clear}
          </Button>
        )}
      </div>
    </div>
  )
}
