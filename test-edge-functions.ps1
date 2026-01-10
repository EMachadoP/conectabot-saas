#!/usr/bin/env pwsh

# Script de Teste das Edge Functions
# Este script testa as Edge Functions evolution-qr e evolution-session

Write-Host "🧪 Teste das Edge Functions - ConectaBot" -ForegroundColor Cyan
Write-Host ""

# Configurações
$SUPABASE_URL = "https://rzlrslywbszlffmaglln.supabase.co"
$TEAM_ID = "00000000-0000-0000-0000-000000000001"

# Solicitar token
Write-Host "📝 Por favor, forneça sua ANON KEY ou JWT Token:" -ForegroundColor Yellow
Write-Host "   Você pode encontrar no Supabase → Settings → API → anon/public" -ForegroundColor Gray
$TOKEN = Read-Host "Token"

if ([string]::IsNullOrWhiteSpace($TOKEN)) {
    Write-Host "❌ Token não fornecido. Abortando." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Teste 1: evolution-health
Write-Host ""
Write-Host "1️⃣ Testando evolution-health..." -ForegroundColor Cyan
$healthUrl = "$SUPABASE_URL/functions/v1/evolution-health"
$body = @{ team_id = $TEAM_ID } | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $healthUrl `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
            "apikey" = $TOKEN
        } `
        -Body $body `
        -UseBasicParsing

    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "📦 Response:" -ForegroundColor White
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Teste 2: evolution-qr
Write-Host ""
Write-Host "2️⃣ Testando evolution-qr..." -ForegroundColor Cyan
$qrUrl = "$SUPABASE_URL/functions/v1/evolution-qr"

try {
    $response = Invoke-WebRequest -Uri $qrUrl `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
            "apikey" = $TOKEN
        } `
        -Body $body `
        -UseBasicParsing

    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "📦 Response:" -ForegroundColor White
    $result = $response.Content | ConvertFrom-Json
    
    # Mostrar resumo sem QR base64 completo (muito grande)
    $summary = @{
        ok = $result.ok
        team_id = $result.team_id
        instance_key = $result.instance_key
        qr_type = $result.qr.type
        qr_preview = if ($result.qr.value) { $result.qr.value.Substring(0, [Math]::Min(50, $result.qr.value.Length)) + "..." } else { $null }
    }
    $summary | ConvertTo-Json -Depth 10
    
    Write-Host ""
    Write-Host "💡 QR Code gerado com sucesso! (preview truncado)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
        
        # Tentar ler body do erro
        try {
            $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $streamReader.ReadToEnd()
            $streamReader.Close()
            Write-Host "   Body: $errorBody" -ForegroundColor Yellow
        } catch {
            Write-Host "   (Não foi possível ler o body do erro)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Teste 3: evolution-session
Write-Host ""
Write-Host "3️⃣ Testando evolution-session (status check)..." -ForegroundColor Cyan
$sessionUrl = "$SUPABASE_URL/functions/v1/evolution-session"
$sessionBody = @{ 
    team_id = $TEAM_ID
    action = "status"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $sessionUrl `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
            "apikey" = $TOKEN
        } `
        -Body $sessionBody `
        -UseBasicParsing

    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "📦 Response:" -ForegroundColor White
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
        
        try {
            $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $streamReader.ReadToEnd()
            $streamReader.Close()
            Write-Host "   Body: $errorBody" -ForegroundColor Yellow
        } catch {
            Write-Host "   (Não foi possível ler o body do erro)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Testes concluídos!" -ForegroundColor Green
Write-Host ""
