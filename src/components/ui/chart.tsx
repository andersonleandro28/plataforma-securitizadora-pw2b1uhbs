import * as React from 'react'
import { Tooltip, Legend } from 'recharts'
import { cn } from '@/lib/utils'

export function ChartContainer({
  config,
  children,
  className,
}: {
  config: any
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('w-full', className)}>{children}</div>
}

export const ChartTooltip = Tooltip

export function ChartTooltipContent({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
            <span className="font-bold text-muted-foreground">{payload[0].value}</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export const ChartLegend = Legend

export function ChartLegendContent({ payload }: any) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-sm pt-2">
      {payload?.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}
