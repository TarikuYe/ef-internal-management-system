$file = "c:\Users\user\Desktop\test\New folder\Deploy\efreportportal\components\admin-panel.tsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$idx = $content.IndexOf("mobileMenuOpen, setMobileMenuOpen")
Write-Host "Index: $idx"
if ($idx -ge 0) {
  Write-Host $content.Substring([Math]::Max(0,$idx-60), 200)
}
