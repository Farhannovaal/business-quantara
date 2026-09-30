$ErrorActionPreference = "Stop"

$root = Join-Path (Get-Location) "src\app"

# ============================================================
# TARGET DEFINITIONS
# ============================================================

$targets = @(
    @{
        File = "operations\spk\page.tsx"
        Actions = @(
            @{
                Name = "SPK Create"
                Permission = "spk.create"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Create SPK)(.*?)(</button>)'
            },
            @{
                Name = "SPK Edit"
                Permission = "spk.update"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "SPK Delete"
                Permission = "spk.delete"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "master\products\page.tsx"
        Actions = @(
            @{
                Name = "Product Create"
                Permission = "product.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Add Product|Tambah Produk|Tambah Product|Create Product)(.*?)(</button>)'
            },
            @{
                Name = "Product Edit"
                Permission = "product.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Product Delete"
                Permission = "product.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "master\tailors\page.tsx"
        Actions = @(
            @{
                Name = "Tailor Create"
                Permission = "tailor.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Add Tailor|Tambah Penjahit|Tambah Tailor|Create Tailor)(.*?)(</button>)'
            },
            @{
                Name = "Tailor Edit"
                Permission = "tailor.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Tailor Delete"
                Permission = "tailor.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "master\employees\page.tsx"
        Actions = @(
            @{
                Name = "Employee Create"
                Permission = "employee.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Add Employee|Tambah Employee|Tambah Karyawan|Create Employee)(.*?)(</button>)'
            },
            @{
                Name = "Employee Edit"
                Permission = "employee.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Employee Delete"
                Permission = "employee.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "operations\transactions\page.tsx"
        Actions = @(
            @{
                Name = "Transaction Submit"
                Permission = "transaction.create"
                Pattern = '(?s)(<button\b[^>]*type="submit"[^>]*>)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "master\transaction-types\page.tsx"
        Actions = @(
            @{
                Name = "Transaction Type Create"
                Permission = "transaction.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Add Transaction Type|Tambah Transaction Type|Create Transaction Type)(.*?)(</button>)'
            },
            @{
                Name = "Transaction Type Edit"
                Permission = "transaction.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Transaction Type Delete"
                Permission = "transaction.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "automation\workflows\page.tsx"
        Actions = @(
            @{
                Name = "Workflow Create"
                Permission = "workflow.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Create Workflow|Tambah Workflow|Add Workflow|Create)(.*?)(</button>)'
            },
            @{
                Name = "Workflow Edit"
                Permission = "workflow.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Workflow Delete"
                Permission = "workflow.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "automation\workflows\[id]\page.tsx"
        Actions = @(
            @{
                Name = "Workflow Step Create"
                Permission = "workflow.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Add Step|Tambah Step|Create Step)(.*?)(</button>)'
            },
            @{
                Name = "Workflow Step Edit"
                Permission = "workflow.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Workflow Step Delete"
                Permission = "workflow.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    },

    @{
        File = "automation\rules\page.tsx"
        Actions = @(
            @{
                Name = "Rule Create"
                Permission = "rule.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Create Rule|Tambah Rule|Add Rule|Create)(.*?)(</button>)'
            },
            @{
                Name = "Rule Edit"
                Permission = "rule.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Edit|Ubah)(.*?)(</button>)'
            },
            @{
                Name = "Rule Delete"
                Permission = "rule.manage"
                Pattern = '(?s)(<button\b[^>]*>)(.*?)(Delete|Hapus)(.*?)(</button>)'
            }
        )
    }
)

# ============================================================
# ADD PERMISSION GATE IMPORT
# ============================================================

function Ensure-PermissionGateImport {
    param(
        [string]$Content
    )

    if (
        $Content -match
        'import\s+PermissionGate\s+from\s+["'']@/components/auth/permission-gate["''];?'
    ) {
        return $Content
    }

    $lines = $Content -split "`r?`n"

    $lastImportIndex = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*import\s+') {
            $lastImportIndex = $i
        }
    }

    if ($lastImportIndex -ge 0) {
        $before = $lines[0..$lastImportIndex]
        $after = @()

        if ($lastImportIndex + 1 -lt $lines.Count) {
            $after = $lines[($lastImportIndex + 1)..($lines.Count - 1)]
        }

        $lines = @(
            $before
            'import PermissionGate from "@/components/auth/permission-gate";'
            $after
        )

        return ($lines -join "`r`n")
    }

    return (
        'import PermissionGate from "@/components/auth/permission-gate";' +
        "`r`n" +
        $Content
    )
}

# ============================================================
# WRAP BUTTON
# ============================================================

function Wrap-FirstMatchingButton {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Permission
    )

    $regex = [regex]::new(
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $match = $regex.Match($Content)

    if (-not $match.Success) {
        return @{
            Changed = $false
            Content = $Content
        }
    }

    $fullButton = $match.Value

    # Jangan wrap lagi jika sudah mengandung PermissionGate
    if (
        $fullButton -match
        [regex]::Escape($Permission)
    ) {
        return @{
            Changed = $false
            Content = $Content
        }
    }

    $replacement = @"
<PermissionGate permission="$Permission">
  $fullButton
</PermissionGate>
"@

    $newContent =
        $Content.Substring(
            0,
            $match.Index
        ) +
        $replacement +
        $Content.Substring(
            $match.Index + $match.Length
        )

    return @{
        Changed = $true
        Content = $newContent
    }
}

# ============================================================
# DRY RUN
# ============================================================

$dryRun = $args -contains "-DryRun"

$changedFiles = @{}
$actionsFound = 0
$actionsSkipped = 0

foreach ($target in $targets) {

    $relativePath = $target.File

    # IMPORTANT:
    # LiteralPath diperlukan karena ada folder [id]
    $filePath = Join-Path `
        $root `
        $relativePath

    if (-not (Test-Path -LiteralPath $filePath)) {
        Write-Host (
            "[!] File tidak ditemukan: {0}" -f `
            $relativePath
        ) -ForegroundColor Yellow

        continue
    }

    # ========================================================
    # READ FILE ONCE
    # ========================================================

    $content = Get-Content `
        -LiteralPath $filePath `
        -Raw `
        -Encoding UTF8

    $originalContent = $content
    $fileChanged = $false

    # ========================================================
    # PROCESS ALL ACTIONS IN THIS FILE
    # ========================================================

    foreach ($action in $target.Actions) {

        $result = Wrap-FirstMatchingButton `
            -Content $content `
            -Pattern $action.Pattern `
            -Permission $action.Permission

        if ($result.Changed) {

            $content = $result.Content
            $fileChanged = $true
            $actionsFound++

            Write-Host (
                "[+] {0} -> {1}" -f `
                $action.Name,
                $action.Permission
            ) -ForegroundColor Green
        }
        else {

            $actionsSkipped++

            Write-Host (
                "[!] {0} tidak ditemukan / sudah diproteksi" -f `
                $action.Name
            ) -ForegroundColor Yellow
        }
    }

    # ========================================================
    # ADD IMPORT
    # ========================================================

    if ($fileChanged) {

        $content =
            Ensure-PermissionGateImport `
                -Content $content

        $changedFiles[$relativePath] = @{
            Path = $filePath
            Original = $originalContent
            Updated = $content
        }
    }
}

# ============================================================
# SUMMARY
# ============================================================

Write-Host ""
Write-Host "==============================================" `
    -ForegroundColor Cyan

Write-Host "BUTTON RBAC PROTECTION" `
    -ForegroundColor Cyan

Write-Host "==============================================" `
    -ForegroundColor Cyan

Write-Host ""

Write-Host "Files affected : $($changedFiles.Count)"
Write-Host "Actions found  : $actionsFound"
Write-Host "Skipped        : $actionsSkipped"

Write-Host ""

if ($dryRun) {

    Write-Host "DRY RUN" `
        -ForegroundColor Yellow

    Write-Host "Tidak ada file yang diubah." `
        -ForegroundColor Yellow

    Write-Host ""

    exit 0
}

# ============================================================
# APPLY CHANGES
# ============================================================

foreach ($entry in $changedFiles.GetEnumerator()) {

    $path = $entry.Value.Path
    $original = $entry.Value.Original
    $updated = $entry.Value.Updated

    $backupPath = "$path.bak"

    if (-not (Test-Path -LiteralPath $backupPath)) {

        Set-Content `
            -LiteralPath $backupPath `
            -Value $original `
            -Encoding UTF8
    }

    Set-Content `
        -LiteralPath $path `
        -Value $updated `
        -Encoding UTF8

    Write-Host (
        "[UPDATED] {0}" -f `
        $entry.Key
    ) -ForegroundColor Green
}

Write-Host ""

Write-Host "Button RBAC protection selesai." `
    -ForegroundColor Green

Write-Host ""

Write-Host "Backup file dibuat dengan extension .bak" `
    -ForegroundColor DarkGray