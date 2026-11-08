
# ==============================================
# TODAVÍA HAY
# INSTALACIÓN DE ACCESOS Y RECOMPENSAS
# ==============================================
#
# Agrega:
# - Invitación de registro en el chatbot.
# - Enlace Crear cuenta en la página pública.
# - Regreso al negocio mediante next.
#
# No modifica:
# - Base de datos.
# - Pedidos existentes.
# - NIP de recogida.
# - PIN del administrador.
# - Configuración de PayPal.
#
# ==============================================

$ErrorActionPreference = 'Stop'

# Rutas de los archivos.
$chat = 'src/components/AgentChat.tsx'
$page = 'src/app/[lang]/[slug]/page.tsx'
$component = 'src/components/RewardsChatInvite.tsx'

# ==============================================
# 1. COMPROBAR ARCHIVOS
# ==============================================

if (-not (Test-Path -LiteralPath $chat)) {
    throw "No se encontró $chat"
}

if (-not (Test-Path -LiteralPath $page)) {
    throw "No se encontró $page"
}

if (-not (Test-Path -LiteralPath $component)) {
    throw "No se encontró $component"
}

# ==============================================
# 2. LEER CÓDIGO EXISTENTE
# ==============================================

$chatPath = (Resolve-Path -LiteralPath $chat).Path
$pagePath = (Resolve-Path -LiteralPath $page).Path

$chatText = [System.IO.File]::ReadAllText($chatPath)
$pageText = [System.IO.File]::ReadAllText($pagePath)

# ==============================================
# 3. AGREGAR COMPONENTE AL CHATBOT
# ==============================================

if ($chatText -notmatch 'RewardsChatInvite') {

    $importMarker = 'import type { Dictionary }'

    if (-not $chatText.Contains($importMarker)) {
        throw "No se encontró el punto de importación en AgentChat.tsx"
    }

    $newImport = @'
import { RewardsChatInvite } from "./RewardsChatInvite";
'@

    $chatText = $chatText.Replace(
        $importMarker,
        $newImport + "`n" + $importMarker
    )

    # Buscar la sección principal del chatbot.
    $sectionRegex = '(<section\b[^>]*className="[^"]*"[^>]*>)'

    if ($chatText -notmatch $sectionRegex) {
        throw "No se encontró la sección principal del chatbot"
    }

    # Agregar la invitación al inicio del chat.
    $invitation = @'
      <RewardsChatInvite
        slug={slug}
        lang={lang}
        signedIn={signedIn}
      />
'@

    $regex = [regex]::new($sectionRegex)

    $chatText = $regex.Replace(
        $chatText,
        '$1' + "`n" + $invitation,
        1
    )
}

# ==============================================
# 4. AGREGAR CREAR CUENTA AL NEGOCIO
# ==============================================

if ($pageText -notmatch 'registro\?next=') {

    $navMarker = '<nav className="mb-4 flex justify-end gap-4 text-sm">'

    if (-not $pageText.Contains($navMarker)) {
        throw "No se encontró el menú de navegación en page.tsx"
    }

    $newNavigation = @'
<nav className="mb-4 flex justify-end gap-4 text-sm">
        {authEnabled() && !me && (
          <Link
            className="font-semibold text-brand underline"
            href={`/${lang}/registro?next=${encodeURIComponent(`/${lang}/${slug}#chat`)}`}
          >
            {lang === "es" ? "Crear cuenta" : "Sign up"}
          </Link>
        )}
'@

    $pageText = $pageText.Replace(
        $navMarker,
        $newNavigation.TrimEnd()
    )
}

# ==============================================
# 5. CREAR COPIAS DE SEGURIDAD
# ==============================================

Copy-Item -LiteralPath $chat `
    -Destination "$chat.bak-recompensas" `
    -Force

Copy-Item -LiteralPath $page `
    -Destination "$page.bak-recompensas" `
    -Force

# ==============================================
# 6. GUARDAR ARCHIVOS MODIFICADOS
# ==============================================

$utf8 = [System.Text.UTF8Encoding]::new($false)

[System.IO.File]::WriteAllText(
    $chatPath,
    $chatText,
    $utf8
)

[System.IO.File]::WriteAllText(
    $pagePath,
    $pageText,
    $utf8
)

# ==============================================
# 7. RESULTADO
# ==============================================

Write-Host ""
Write-Host "CAMBIOS APLICADOS" -ForegroundColor Green
Write-Host ""
Write-Host "Se agregó la invitación de recompensas."
Write-Host "Se agregó Crear cuenta al negocio."
Write-Host "Se conservó el chatbot existente."
Write-Host "Se crearon copias de seguridad."
Write-Host ""
Write-Host "Ejecuta ahora:"
Write-Host "npx tsc --noEmit"
Write-Host "npm run build"
