'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'

interface DepartmentHeaderProps {
  departmentName: string
  roleName: string
  userName: string
  description?: string
}

export function DepartmentHeader({
  departmentName,
  roleName,
  userName,
  description,
}: DepartmentHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-5 md:flex-row md:items-center md:justify-between md:gap-4 md:pb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge variant="outline" className="font-semibold uppercase tracking-wider text-[10px] text-primary bg-primary/5 border-primary/20 px-2 py-0.5">
            {roleName}
          </Badge>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs font-medium text-muted-foreground">Logged in as {userName}</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {departmentName}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mt-1.5">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
