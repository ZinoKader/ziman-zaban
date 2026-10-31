import { Hammer } from 'lucide-react'

/** Temporary page body for sections that are not built yet. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
      <Hammer className="size-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{title}</h1>
    </div>
  )
}
