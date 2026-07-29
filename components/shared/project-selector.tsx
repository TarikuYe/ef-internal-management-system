'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Project {
  code: string
  name: string
  active: boolean
}

interface ProjectSelectorProps {
  projects: Project[]
  selectedProjectCode: string
  onSelectProject: (code: string) => void
  disabled?: boolean
}

export function ProjectSelector({
  projects,
  selectedProjectCode,
  onSelectProject,
  disabled = false,
}: ProjectSelectorProps) {
  const activeProjects = React.useMemo(() => {
    return projects.filter((p) => p.active)
  }, [projects])

  return (
    <div className="space-y-1.5 w-full">
      <Label htmlFor="project-selector" className="text-xs font-semibold text-muted-foreground uppercase">
        Select Project
      </Label>
      <Select
        value={selectedProjectCode}
        onValueChange={(val) => onSelectProject(val || '')}
        disabled={disabled || activeProjects.length === 0}
      >
        <SelectTrigger id="project-selector" className="w-full bg-card">
          <SelectValue placeholder={activeProjects.length === 0 ? "No active projects available" : "Choose a project..."} />
        </SelectTrigger>
        <SelectContent>
          {activeProjects.map((project) => (
            <SelectItem key={project.code} value={project.code}>
              <span className="font-mono text-xs font-bold text-primary mr-2 bg-primary/10 px-1 rounded">
                {project.code}
              </span>
              <span className="text-sm font-medium">{project.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
