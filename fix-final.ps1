$file = "c:\Users\user\Desktop\test\New folder\Deploy\efreportportal\components\admin-panel.tsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Replace the entire state initialization + effects block with the correct pattern:
# - useState lazy initializer reads localStorage directly (runs only on client, once)
# - Single auto-save effect (no guard needed since init already has correct data)
# - No separate load effect needed

$startMarker = "  // --- Initial Form State - static default on both server and client (no SSR mismatch) ---"
$endMarker   = "  // --- Dynamic Field Update Helpers ---"

# Find markers (using the actual box-drawing characters in the file)
$dynamicHelpers = "Dynamic Field Update Helpers"
$endIdx = $content.IndexOf($dynamicHelpers)

if ($endIdx -lt 0) {
  Write-Error "Cannot find 'Dynamic Field Update Helpers' marker"
  exit 1
}

# Walk back to find the start of that comment line
$endLineStart = $content.LastIndexOf("`n", $endIdx)
if ($endLineStart -lt 0) { $endLineStart = 0 }

$startIdx = $content.IndexOf("// --- Initial Form State - static default")
if ($startIdx -lt 0) {
  Write-Error "Cannot find start marker"
  exit 1
}
$blockStart = $content.LastIndexOf("`n", $startIdx) + 1

$newBlock = @'
  // Initialize from localStorage immediately (lazy initializer only runs on client, once on mount)
  // This is the correct pattern: no separate load effect, no race condition, no hydration mismatch
  // because TabHealth is only rendered after client hydration is complete (it's inside Suspense).
  const [formState, setFormState] = useState<any>(() => {
    const defaults = getDefaultFormState()
    if (typeof window === 'undefined') return defaults
    try {
      const saved = localStorage.getItem('efarch-daily-ops-form')
      if (saved) return JSON.parse(saved)
    } catch (_) {}
    return defaults
  })

  // Auto-save on every change (no guard needed - state is already loaded correctly above)
  React.useEffect(() => {
    if (formState) {
      localStorage.setItem('efarch-daily-ops-form', JSON.stringify(formState))
    }
  }, [formState])

'@

$before = $content.Substring(0, $blockStart)
$after  = $content.Substring($endLineStart)

$newContent = $before + $newBlock + $after

[System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done! Length: $($newContent.Length) (was $($content.Length))"
Write-Host "Block start at: $blockStart"
Write-Host "Block end at: $endLineStart"
