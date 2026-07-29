'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileStack } from 'lucide-react'

interface GenericDataTableProps {
  headers: string[]
  rows: (React.ReactNode | string | number | null)[][]
  emptyMessage?: string
}

export function GenericDataTable({
  headers,
  rows,
  emptyMessage = 'No records found.',
}: GenericDataTableProps) {
  return (
    <div className="rounded-md border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader className="bg-secondary/40">
          <TableRow>
            {headers.map((h, i) => (
              <TableHead key={i} className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="h-48 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileStack className="size-8 text-muted-foreground/55 stroke-[1.5]" />
                  <span className="text-sm">{emptyMessage}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="text-sm text-foreground">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
