$file = "c:\Users\user\Desktop\test\New folder\Deploy\efreportportal\components\admin-panel.tsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Step 1: Add mounted state after mobileMenuOpen declaration
# Use a unique enough anchor
$anchor = "  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)"
$idx = $content.IndexOf($anchor)
Write-Host "Anchor index: $idx"
if ($idx -lt 0) { Write-Error "Anchor not found!"; exit 1 }

$insertAfter = $idx + $anchor.Length
$insertion = "`n  // Prevent SSR rendering of tab content (avoids hydration mismatches)`n  const [mounted, setMounted] = useState(false)`n  React.useEffect(() => { setMounted(true) }, [])"

$content = $content.Substring(0, $insertAfter) + $insertion + $content.Substring($insertAfter)
Write-Host "Step 1 done"

# Step 2: Replace the Tab content comment + ActiveComponent render
# Find the exact string
$oldSection = "{/* Tab content */}"
$oldRender  = "<ActiveComponent />"

$tabIdx = $content.IndexOf($oldSection)
Write-Host "Tab content comment index: $tabIdx"
if ($tabIdx -lt 0) { Write-Error "Tab content comment not found!"; exit 1 }

$renderIdx = $content.IndexOf($oldRender, $tabIdx)
Write-Host "ActiveComponent render index: $renderIdx"
if ($renderIdx -lt 0) { Write-Error "ActiveComponent not found!"; exit 1 }

# Build replacement: replace just the comment + render block
$blockStart = $tabIdx
$blockEnd   = $renderIdx + $oldRender.Length

$newBlock = "{/* Tab content - rendered only after hydration to prevent SSR mismatches */}" + "`n      " + "{mounted ? <ActiveComponent /> : (`n        <div className=" + [char]34 + "flex items-center justify-center py-20 text-muted-foreground text-sm" + [char]34 + ">`n          <svg className=" + [char]34 + "animate-spin size-5 mr-2" + [char]34 + " viewBox=" + [char]34 + "0 0 24 24" + [char]34 + " fill=" + [char]34 + "none" + [char]34 + "><circle cx=" + [char]34 + "12" + [char]34 + " cy=" + [char]34 + "12" + [char]34 + " r=" + [char]34 + "10" + [char]34 + " stroke=" + [char]34 + "currentColor" + [char]34 + " strokeWidth=" + [char]34 + "3" + [char]34 + " strokeDasharray=" + [char]34 + "30 70" + [char]34 + " /></svg>`n          Loading...`n        </div>`n      )}"

$content = $content.Substring(0, $blockStart) + $newBlock + $content.Substring($blockEnd)
Write-Host "Step 2 done"

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "All done! Length: $($content.Length)"
