[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$SourcePath,

  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$masterSize = 320
$badgeBounds = New-Object System.Drawing.Rectangle(186, 186, 126, 126)
$darkBlue = [System.Drawing.ColorTranslator]::FromHtml('#12386B')
$teal = [System.Drawing.ColorTranslator]::FromHtml('#008E9A')
$white = [System.Drawing.Color]::White

function Set-QualityDrawingMode {
  param([System.Drawing.Graphics]$Graphics)

  $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
}

function Write-ResizedPng {
  param(
    [System.Drawing.Bitmap]$SourceBitmap,
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = $null
  $graphics = $null
  try {
    $bitmap = New-Object System.Drawing.Bitmap(
      $Size,
      $Size,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    Set-QualityDrawingMode -Graphics $graphics
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage(
      $SourceBitmap,
      (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)),
      0,
      0,
      $SourceBitmap.Width,
      $SourceBitmap.Height,
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    if ($null -ne $graphics) { $graphics.Dispose() }
    if ($null -ne $bitmap) { $bitmap.Dispose() }
  }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$sourceBitmap = $null
$masterBitmap = $null
$graphics = $null
$outerBrush = $null
$innerBrush = $null
$globePen = $null
$clipPath = $null
$state = $null

try {
  $sourceBitmap = [System.Drawing.Bitmap]::FromFile($SourcePath)
  $masterBitmap = New-Object System.Drawing.Bitmap(
    $masterSize,
    $masterSize,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($masterBitmap)
  Set-QualityDrawingMode -Graphics $graphics
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.DrawImage(
    $sourceBitmap,
    (New-Object System.Drawing.Rectangle(0, 0, $masterSize, $masterSize)),
    0,
    0,
    $sourceBitmap.Width,
    $sourceBitmap.Height,
    [System.Drawing.GraphicsUnit]::Pixel
  )

  # 126px (31.5px at 80px) plus 9px grid strokes keeps the globe legible at 16px.
  $outerBrush = New-Object System.Drawing.SolidBrush($darkBlue)
  $innerBrush = New-Object System.Drawing.SolidBrush($teal)
  $globePen = New-Object System.Drawing.Pen($white, 9)
  $graphics.FillEllipse($outerBrush, $badgeBounds)
  $graphics.FillEllipse($innerBrush, 194, 194, 110, 110)

  $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $clipPath.AddEllipse(194, 194, 110, 110)
  $state = $graphics.Save()
  $graphics.SetClip($clipPath)
  foreach ($y in @(222, 249, 276)) {
    $graphics.DrawLine($globePen, 192, $y, 306, $y)
  }
  $graphics.DrawLine($globePen, 249, 190, 249, 308)
  $graphics.DrawEllipse($globePen, 218, 192, 62, 114)
  $graphics.Restore($state)
  $state = $null

  $masterPath = Join-Path $OutputDirectory 'global-icon-master.png'
  $masterBitmap.Save($masterPath, [System.Drawing.Imaging.ImageFormat]::Png)

  foreach ($size in @(16, 32, 64, 80)) {
    Write-ResizedPng -SourceBitmap $masterBitmap -Size $size -OutputPath (
      Join-Path $OutputDirectory ("global-icon-$size.png")
    )
  }
  foreach ($size in @(16, 32, 80)) {
    Write-ResizedPng -SourceBitmap $masterBitmap -Size $size -OutputPath (
      Join-Path $OutputDirectory ("global-ribbon-$size.png")
    )
  }
}
finally {
  if ($null -ne $state -and $null -ne $graphics) { $graphics.Restore($state) }
  if ($null -ne $clipPath) { $clipPath.Dispose() }
  if ($null -ne $globePen) { $globePen.Dispose() }
  if ($null -ne $innerBrush) { $innerBrush.Dispose() }
  if ($null -ne $outerBrush) { $outerBrush.Dispose() }
  if ($null -ne $graphics) { $graphics.Dispose() }
  if ($null -ne $masterBitmap) { $masterBitmap.Dispose() }
  if ($null -ne $sourceBitmap) { $sourceBitmap.Dispose() }
}
