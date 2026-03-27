# Deploy de Todas as Edge Functions
# Faz deploy dinamico de todas as pastas em supabase/functions que possuem index.ts

Write-Host "🚀 Iniciando deploy de todas as Edge Functions..." -ForegroundColor Cyan
Write-Host ""

$functionsRoot = Join-Path $PSScriptRoot "supabase\functions"

if (-not (Test-Path $functionsRoot)) {
    Write-Host "❌ Diretório de funções não encontrado: $functionsRoot" -ForegroundColor Red
    exit 1
}

$functions = Get-ChildItem $functionsRoot -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "index.ts") } |
    Select-Object -ExpandProperty Name |
    Sort-Object

if (-not $functions -or $functions.Count -eq 0) {
    Write-Host "⚠️  Nenhuma Edge Function encontrada para deploy." -ForegroundColor Yellow
    exit 0
}

$success = 0
$failed = 0

foreach ($func in $functions) {
    Write-Host "📦 Deploying $func..." -ForegroundColor Yellow

    try {
        npx supabase functions deploy $func

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $func deployed successfully!" -ForegroundColor Green
            $success++
        } else {
            Write-Host "❌ Failed to deploy $func" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "❌ Error deploying $func : $_" -ForegroundColor Red
        $failed++
    }

    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 Resumo do Deploy:" -ForegroundColor Cyan
Write-Host "✅ Sucesso: $success" -ForegroundColor Green
Write-Host "❌ Falhas: $failed" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "🎉 Todas as Edge Functions foram deployadas com sucesso!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Algumas funções falharam. Verifique os erros acima." -ForegroundColor Yellow
}
