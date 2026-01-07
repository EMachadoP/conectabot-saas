# PowerShell script to trigger the reminder-dispatcher manually
# Usage: ./scripts/trigger-dispatcher.ps1

$SUPABASE_STATUS = supabase status -o json | ConvertFrom-Json
$ANON_KEY = $SUPABASE_STATUS.ANON_KEY
$SERVICE_ROLE_KEY = $SUPABASE_STATUS.SERVICE_ROLE_KEY
$API_URL = "http://127.0.0.1:54321/functions/v1/reminder-dispatcher"

Write-Host "---" -ForegroundColor Gray
Write-Host "Triggering reminder-dispatcher..." -ForegroundColor Cyan

try {
    $headers = @{
        "Authorization" = "Bearer $SERVICE_ROLE_KEY"
        "Content-Type"  = "application/json"
    }

    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers
    
    Write-Host "Success!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json) -ForegroundColor Gray
}
catch {
    Write-Host "Error calling function:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host "---" -ForegroundColor Gray
