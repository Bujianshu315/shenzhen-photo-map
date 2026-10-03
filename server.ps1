param(
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$url = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "  [!] Port $Port is already in use."
    Write-Host "      Opening the browser anyway - a server is probably already running."
    Write-Host ""
    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/index.html" }
    Start-Sleep -Seconds 2
    exit 0
}

$mime = @{
    ".html"  = "text/html; charset=utf-8"
    ".htm"   = "text/html; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".svg"   = "image/svg+xml"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".webp"  = "image/webp"
    ".gif"   = "image/gif"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
}

Write-Host ""
Write-Host "  Local preview server started."
Write-Host "  Root : $root"
Write-Host "  URL  : $url"
Write-Host ""
Write-Host "  Close this window to stop the server."
Write-Host ""

if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/index.html" }

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }

    $req = $ctx.Request
    $res = $ctx.Response

    try {
        $relPath = [System.Uri]::UnescapeDataString($req.Url.LocalPath)
        if ([string]::IsNullOrEmpty($relPath) -or $relPath -eq "/") {
            $relPath = "/index.html"
        }
        $relPath = $relPath.TrimStart("/")
        $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relPath))

        if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $res.StatusCode = 403
            $res.ContentType = "text/plain; charset=utf-8"
            $body = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $res.ContentLength64 = $body.Length
            $res.OutputStream.Write($body, 0, $body.Length)
        } elseif (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            if ($mime.ContainsKey($ext)) {
                $res.ContentType = $mime[$ext]
            } else {
                $res.ContentType = "application/octet-stream"
            }
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $res.ContentType = "text/plain; charset=utf-8"
            $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $res.ContentLength64 = $body.Length
            $res.OutputStream.Write($body, 0, $body.Length)
        }
    } catch {
        try { $res.StatusCode = 500 } catch { }
    } finally {
        try { $res.OutputStream.Close() } catch { }
    }
}
