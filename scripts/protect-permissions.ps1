param(
    [switch]$Apply
)

$Root = Join-Path (Get-Location) "src\app\api"

$ImportLine = 'import { requirePermission } from "@/lib/auth/authorization";'

$PermissionMap = @{
    "dashboard" = @{
        "GET" = "dashboard.view"
    }

    "products" = @{
        "GET"    = "product.view"
        "POST"   = "product.manage"
        "PATCH"  = "product.manage"
        "DELETE" = "product.manage"
    }

    "tailors" = @{
        "GET"    = "tailor.view"
        "POST"   = "tailor.manage"
        "PATCH"  = "tailor.manage"
        "DELETE" = "tailor.manage"
    }

    "employees" = @{
        "GET"    = "employee.view"
        "POST"   = "employee.manage"
        "PATCH"  = "employee.manage"
        "DELETE" = "employee.manage"
    }

    "spks" = @{
        "GET"    = "spk.view"
        "POST"   = "spk.create"
        "PATCH"  = "spk.update"
        "DELETE" = "spk.delete"
    }

    "transactions" = @{
        "GET"  = "transaction.view"
        "POST" = "transaction.create"
    }

    "tracking" = @{
        "GET" = "tracking.view"
    }

    "transaction-types" = @{
        "GET"    = "transaction.view"
        "POST"   = "transaction.manage"
        "PATCH"  = "transaction.manage"
        "DELETE" = "transaction.manage"
    }

    "workflows" = @{
        "GET"    = "workflow.view"
        "POST"   = "workflow.manage"
        "PATCH"  = "workflow.manage"
        "DELETE" = "workflow.manage"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Overpassion Operation Permission Protection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$files = Get-ChildItem -Path $Root -Filter "route.ts" -Recurse |
    Sort-Object FullName

$found = 0
$changed = 0
$skipped = 0

foreach ($file in $files) {

    $relativePath = $file.FullName.Substring(
        (Get-Location).Path.Length + 1
    )

    $normalized = $relativePath -replace "\\", "/"

    # Auth routes jangan disentuh
    if ($normalized -match "^src/app/api/auth/") {
        Write-Host "[SKIP] $relativePath" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Test DB jangan disentuh
    if ($normalized -match "^src/app/api/test-db/") {
        Write-Host "[SKIP] $relativePath" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Tentukan module
    $parts = $normalized -split "/"

    $apiIndex = [Array]::IndexOf($parts, "api")

    if ($apiIndex -lt 0 -or ($apiIndex + 1) -ge $parts.Count) {
        continue
    }

    $module = $parts[$apiIndex + 1]

    if (-not $PermissionMap.ContainsKey($module)) {
        Write-Host "[SKIP] $relativePath - no permission mapping" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    $content = [System.IO.File]::ReadAllText($file.FullName)

    # Cari HTTP methods
    $methods = @()

    foreach ($method in @("GET","POST","PUT","PATCH","DELETE")) {
        if ($content -match "export\s+async\s+function\s+$method\s*\(") {
            $methods += $method
        }
    }

    if ($methods.Count -eq 0) {
        continue
    }

    $found++

    Write-Host ""
    Write-Host "[FOUND] $relativePath" -ForegroundColor Yellow

    foreach ($method in $methods) {

        if (-not $PermissionMap[$module].ContainsKey($method)) {
            Write-Host "       $method -> no mapping" -ForegroundColor DarkGray
            continue
        }

        $permission = $PermissionMap[$module][$method]

        Write-Host "       $method -> $permission" -ForegroundColor Yellow
    }

    if (-not $Apply) {
        continue
    }

    # Jangan inject ulang
    if ($content -match "requirePermission\s*\(") {
        Write-Host "       -> already protected" -ForegroundColor Green
        continue
    }

    # Tambahkan import
    if ($content -notmatch 'from\s+["'']@/lib/auth/authorization["'']') {

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

    # Inject permission check ke setiap handler
    foreach ($method in $methods) {

        if (-not $PermissionMap[$module].ContainsKey($method)) {
            continue
        }

        $permission = $PermissionMap[$module][$method]

        $authPattern =
            "(export\s+async\s+function\s+$method\s*\([^)]*\)\s*\{)"

        $match = [regex]::Match(
            $content,
            $authPattern
        )

        if (-not $match.Success) {
            Write-Host "       -> WARNING: handler $method tidak ditemukan" -ForegroundColor Red
            continue
        }

        # Cari requireAuth di awal handler
        $handlerStart = $match.Index + $match.Length

        $afterHandler = $content.Substring(
            $handlerStart,
            [Math]::Min(
                1200,
                $content.Length - $handlerStart
            )
        )

        if ($afterHandler -match "requireAuth\s*\(") {

            $authEndPattern =
                "const\s+\{\s*user,\s*response\s*\}\s*=\s*await\s+requireAuth\(\);\s*if\s*\(response\)\s*\{\s*return\s+response;\s*\}"

            $authMatch = [regex]::Match(
                $afterHandler,
                $authEndPattern,
                [System.Text.RegularExpressions.RegexOptions]::Singleline
            )

            if ($authMatch.Success) {

                $insertAt =
                    $handlerStart +
                    $authMatch.Index +
                    $authMatch.Length

                $permissionBlock = @"

  const permission = requirePermission(
    user,
    "$permission"
  );

  if (permission.response) {
    return permission.response;
  }

"@

                $content =
                    $content.Substring(0, $insertAt) +
                    $permissionBlock +
                    $content.Substring($insertAt)

            } else {

                Write-Host "       -> WARNING: requireAuth ditemukan tetapi struktur tidak dikenali pada $method" -ForegroundColor Red
            }

        } else {

            Write-Host "       -> WARNING: requireAuth tidak ditemukan pada $method" -ForegroundColor Red
        }
    }

    # Backup
    $backupPath = "$($file.FullName).bak"

    if (-not (Test-Path $backupPath)) {
        Copy-Item $file.FullName $backupPath
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        $file.FullName,
        $content,
        $utf8NoBom
    )

    Write-Host "       -> PERMISSION PROTECTED" -ForegroundColor Green

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
    Write-Host "Backup .bak tersedia untuk file yang diubah." -ForegroundColor Yellow
}
else {
    Write-Host "DRY RUN - TIDAK ADA FILE YANG DIUBAH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Routes yang ditemukan : $found"
    Write-Host ""
    Write-Host "Jika mapping sudah benar, jalankan:"
    Write-Host ""
    Write-Host "    .\scripts\protect-permissions.ps1 -Apply" -ForegroundColor White
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""