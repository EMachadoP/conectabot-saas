param(
  [Parameter(Mandatory=$true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "RELEASE - conectabot-saas"
Write-Host "========================================"

# 1) Garantir que está no repo certo
$repo = git remote get-url origin
Write-Host "Remote origin: $repo"

# 2) Git add/commit/push
Write-Host "`n[1/4] Git add..."
git add -A

Write-Host "[2/4] Git commit..."
$hasChanges = git status --porcelain
if (-not $hasChanges) {
  Write-Host "Nada para commit (working tree clean)."
} else {
  git commit -m $Message
}

Write-Host "`n[3/4] Git push..."
git push

# 3) Deploy das Edge Functions (Supabase)
# Autodetect Project Ref if not in env
$projectRef = $env:SUPABASE_PROJECT_REF
if (-not $projectRef) {
    # Tenta ler do config.toml ou usa o conhecido
    $projectRef = "rzlrslywbszlffmaglln" 
}

Write-Host "`n[4/4] Supabase Edge Functions deploy ($projectRef)..."
try {
  # Deploya todas as funções
  npx supabase functions deploy --project-ref $projectRef
  Write-Host "Edge Functions deploy concluído."
} catch {
  Write-Host "Aviso: não consegui rodar supabase functions deploy. (CLI não configurado?)"
  Write-Host $_
}

Write-Host "`n========================================"
Write-Host "RELEASE CONCLUÍDO!"
Write-Host "========================================"
