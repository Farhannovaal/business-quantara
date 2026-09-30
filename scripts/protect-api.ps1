param(
    [switch]$Apply
)

$Root = Join-Path (Get-Location) "src\app\api"

$ExcludedPaths = @(
    "\auth\",
    "\test-db\"
)

$HttpMethods = @(
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
)

$ImportLine = 'import { requireAuth } from "@/lib/auth/require-auth";'

$AuthBlock = @"
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Business Operation API Auth Protection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$files = Get-ChildItem -Path $Root -Filter "route.ts" -Recurse |
    Sort-Object FullName

$changed = 0
$skipped = 0
$found = 0

foreach ($file in $files) {

    $relativePath = $file.FullName.Substring(
        (Get-Location).Path.Length + 1
    )

    # Skip excluded routes
    $excluded = $false

    foreach ($excludedPath in $ExcludedPaths) {
        if ($file.FullName.Contains($excludedPath)) {
            $excluded = $true
            break
        }
    }

    if ($excluded) {
        Write-Host "[SKIP] $relativePath" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    $content = [System.IO.File]::ReadAllText($file.FullName)

    # Skip file if already protected
    if ($content -match 'requireAuth\s*\(') {
        Write-Host "[OK]   $relativePath - already protected" -ForegroundColor Green
        continue
    }

    $methodsFound = @()

    foreach ($method in $HttpMethods) {

        $pattern = "export\s+async\s+function\s+$method\s*\("

        if ($content -match $pattern) {
            $methodsFound += $method
        }
    }

    if ($methodsFound.Count -eq 0) {
        Write-Host "[----] $relativePath - no HTTP handler detected" -ForegroundColor DarkGray
        continue
    }

    $found++

    Write-Host ""
    Write-Host "[FOUND] $relativePath" -ForegroundColor Yellow
    Write-Host "       Methods: $($methodsFound -join ', ')" -ForegroundColor Yellow

    if (-not $Apply) {
        continue
    }

    # Add import if missing
    if ($content -notmatch 'from\s+["'']@/lib/auth/require-auth["'']') {

        # Find first import statement
        $firstImport = [regex]::Match(
            $content,
            '(?m)^import\s+.*;$'
        )

        if ($firstImport.Success) {

            $insertPosition = $firstImport.Index

            $content =
                $content.Substring(0, $insertPosition) +
                $ImportLine + "`r`n" +
                $content.Substring($insertPosition)

        } else {

            $content =
                $ImportLine + "`r`n`r`n" +
                $content
        }
    }

    # Inject auth into each HTTP handler
    #
    # This matches:
    #
    # export async function GET(...) {
    #
    # and inserts auth immediately after {
    #
    foreach ($method in $methodsFound) {

        $pattern =
            "(export\s+async\s+function\s+$method\s*\([^)]*\)\s*\{)"

        $replacement =
            "`$1`r`n" +
            $AuthBlock

        $content = [regex]::Replace(
            $content,
            $pattern,
            $replacement,
            1
        )
    }

    # Backup original
    $backupPath = "$($file.FullName).bak"

    if (-not (Test-Path $backupPath)) {
        Copy-Item $file.FullName $backupPath
    }

    # Write modified file
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        $file.FullName,
        $content,
        $utf8NoBom
    )

    Write-Host "       -> PROTECTED" -ForegroundColor Green

    $changed++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($Apply) {

    Write-Host "DONE" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files changed : $changed"
    Write-Host "Files skipped : $skipped"
    Write-Host "Files found   : $found"
    Write-Host ""
    Write-Host "Backup .bak dibuat untuk file yang diubah." -ForegroundColor Yellow

} else {

    Write-Host "DRY RUN - TIDAK ADA FILE YANG DIUBAH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Routes yang akan diproteksi: $found"
    Write-Host ""
    Write-Host "Kalau hasilnya sudah sesuai, jalankan:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    .\scripts\protect-api.ps1 -Apply" -ForegroundColor White
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""