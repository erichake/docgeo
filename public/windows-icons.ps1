# DocGeo file icons (.dgo, .dgp, .ggb) on Windows, for the editor installed as a Chrome or Edge app.
# Install:   irm https://doctools.org/apps/docgeo/windows-icons.ps1 | iex
# Uninstall: & ([scriptblock]::Create((irm https://doctools.org/apps/docgeo/windows-icons.ps1))) uninstall
# Chrome registers one ProgID per extension with an empty DefaultIcon (",0"): only that value is filled.
# Edge installs an MSIX package with one AppX ProgID for all extensions, showing the app logo: without
# its DefaultIcon, Windows takes the one of SystemFileAssociations\<extension>. A ProgID of our own would
# break double-click: with two handlers and no UserChoice, Windows resolves the extension to "Unknown".
# The open command always stays the browser's.
# Wrapped in a script block so that iex leaves the caller's session untouched.
& {
$ErrorActionPreference = 'Stop'
$url = 'https://doctools.org/apps/docgeo'
$dir = "$env:LOCALAPPDATA\DocGeo\icons"
$site = "$url/editor.html"

$msg = switch -regex ((Get-UICulture).Name) {
  '^fr' { 'Icônes DocGeo installées.', 'Icônes DocGeo retirées.', "DocGeo n’est pas installé depuis Chrome ou Edge : installez-le depuis $site, puis relancez cette commande.", 'Ouvrez une fois un fichier {0} par double-clic et choisissez DocGeo : son icône apparaîtra.' }
  '^de' { 'DocGeo-Symbole installiert.', 'DocGeo-Symbole entfernt.', "DocGeo ist nicht über Chrome oder Edge installiert: Installieren Sie es über $site und führen Sie diesen Befehl dann erneut aus.", 'Öffnen Sie einmal eine {0}-Datei per Doppelklick und wählen Sie DocGeo: Dann erscheint ihr Symbol.' }
  '^es' { 'Iconos de DocGeo instalados.', 'Iconos de DocGeo retirados.', "DocGeo no está instalado desde Chrome o Edge: instálalo desde $site y vuelve a ejecutar este comando.", 'Abre una vez un archivo {0} con doble clic y elige DocGeo: aparecerá su icono.' }
  '^it' { 'Icone di DocGeo installate.', 'Icone di DocGeo rimosse.', "DocGeo non è installato da Chrome o Edge: installalo da $site, poi esegui di nuovo questo comando.", 'Apri una volta un file {0} con un doppio clic e scegli DocGeo: comparirà la sua icona.' }
  '^nl' { 'DocGeo-pictogrammen geïnstalleerd.', 'DocGeo-pictogrammen verwijderd.', "DocGeo is niet vanuit Chrome of Edge geïnstalleerd: installeer het via $site en voer deze opdracht daarna opnieuw uit.", 'Dubbelklik één keer op een {0}-bestand en kies DocGeo: dan verschijnt het pictogram.' }
  '^pt' { 'Ícones do DocGeo instalados.', 'Ícones do DocGeo removidos.', "O DocGeo não está instalado pelo Chrome ou Edge: instale-o em $site e depois execute este comando de novo.", 'Abra uma vez um arquivo {0} com um duplo clique e escolha o DocGeo: o ícone vai aparecer.' }
  '^el' { 'Τα εικονίδια DocGeo εγκαταστάθηκαν.', 'Τα εικονίδια DocGeo αφαιρέθηκαν.', "Το DocGeo δεν έχει εγκατασταθεί από το Chrome ή το Edge: εγκαταστήστε το από $site και μετά εκτελέστε ξανά αυτή την εντολή.", 'Ανοίξτε μία φορά ένα αρχείο {0} με διπλό κλικ και επιλέξτε DocGeo: θα εμφανιστεί το εικονίδιό του.' }
  '^zh-(TW|HK|MO|Hant)' { '已安裝 DocGeo 圖示。', '已移除 DocGeo 圖示。', "尚未透過 Chrome 或 Edge 安裝 DocGeo：請從 $site 安裝，然後再次執行此命令。", '請按兩下開啟一個 {0} 檔案一次並選擇 DocGeo，其圖示就會出現。' }
  '^zh' { '已安装 DocGeo 图标。', '已移除 DocGeo 图标。', "尚未通过 Chrome 或 Edge 安装 DocGeo：请从 $site 安装，然后再次运行此命令。", '请双击打开一个 {0} 文件一次并选择 DocGeo，其图标就会出现。' }
  '^ar' { 'تم تثبيت أيقونات DocGeo.', 'تمت إزالة أيقونات DocGeo.', "لم يُثبَّت DocGeo من Chrome أو Edge: ثبّته من $site ثم شغّل هذا الأمر مرة أخرى.", 'افتح ملف {0} مرة واحدة بنقرة مزدوجة واختر DocGeo: ستظهر أيقونته.' }
  '^hi' { 'DocGeo आइकन इंस्टॉल हो गए।', 'DocGeo आइकन हटा दिए गए।', "DocGeo, Chrome या Edge से इंस्टॉल नहीं है: इसे $site से इंस्टॉल करें, फिर यह कमांड दोबारा चलाएँ।", 'किसी {0} फ़ाइल को एक बार डबल-क्लिक से खोलें और DocGeo चुनें: उसका आइकन दिखने लगेगा।' }
  default { 'DocGeo icons installed.', 'DocGeo icons removed.', "DocGeo is not installed from Chrome or Edge: install it from $site, then run this command again.", 'Double-click a {0} file once and choose DocGeo: its icon will appear.' }
}
# Served without a charset, the script reaches Windows PowerShell 5.1 decoded as ISO-8859-1.
if ('é'.Length -ne 1) { $msg = $msg | ForEach-Object { [Text.Encoding]::UTF8.GetString([Text.Encoding]::GetEncoding(28591).GetBytes($_)) } }

Add-Type -Namespace DocGeo -Name Shell -MemberDefinition @'
[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, uint f, IntPtr a, IntPtr b);
[DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] public static extern int AssocQueryString(int f, int s, string a, string x, System.Text.StringBuilder o, ref uint n);
'@

# One app ProgID per browser and profile where DocGeo is installed: Chrome's lists its file ProgIDs,
# Edge's (AppX) is itself the file ProgID.
$classes = 'HKCU:\Software\Classes'
$exts = 'dgo', 'dgp', 'ggb'
$apps = Get-ChildItem $classes |
  Where-Object { ($_.PSChildName -like 'AppX*' -or $_.GetValue('FileHandlerProgIds')) -and (Get-ItemProperty "$($_.PSPath)\Application" -ErrorAction SilentlyContinue).ApplicationName -eq 'DocGeo' }
$progIds = $apps | Where-Object { $_.GetValue('FileHandlerProgIds') } | ForEach-Object { $_.GetValue('FileHandlerProgIds') -split ';' }
$appx = $apps | Where-Object { -not $_.GetValue('FileHandlerProgIds') } | ForEach-Object PSChildName

if ($args[0] -eq 'uninstall') {
  foreach ($p in $progIds) { Set-ItemProperty "$classes\$p\DefaultIcon" -Name '(default)' -Value ',0' }
  foreach ($p in $appx) {
    New-Item "$classes\$p\DefaultIcon" -Force | Out-Null
    Set-ItemProperty "$classes\$p\DefaultIcon" -Name '(default)' -Value (Get-ItemProperty "$classes\$p\Application").ApplicationIcon
  }
  foreach ($e in $exts) { Remove-Item "$classes\SystemFileAssociations\.$e" -Recurse -Force -ErrorAction SilentlyContinue }
  Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
  [DocGeo.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
  Write-Host $msg[1]
} elseif (-not $apps) {
  Write-Host $msg[2]
} else {
  Add-Type -AssemblyName System.Drawing
  $icons = @{}
  foreach ($e in $exts) {
    # The server refuses requests without a User-Agent, as sent by Net.WebClient.
    $png = (Invoke-WebRequest "$url/file_$e.png" -UseBasicParsing).Content
    $src = [Drawing.Image]::FromStream((New-Object IO.MemoryStream (, $png)))
    $pngs = foreach ($s in 16, 32, 48, 256) {
      $bm = New-Object Drawing.Bitmap $s, $s
      $g = [Drawing.Graphics]::FromImage($bm)
      $g.InterpolationMode = 'HighQualityBicubic'
      $g.PixelOffsetMode = 'HighQuality'
      $g.DrawImage($src, 0, 0, $s, $s)
      $g.Dispose()
      $ms = New-Object IO.MemoryStream
      $bm.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
      $bm.Dispose()
      , @($s, $ms.ToArray())
    }
    $src.Dispose()
    # ICO with PNG entries; a width or height of 0 means 256.
    $out = New-Object IO.MemoryStream
    $w = New-Object IO.BinaryWriter $out
    $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$pngs.Count)
    $off = 6 + 16 * $pngs.Count
    foreach ($p in $pngs) {
      $w.Write([byte]($p[0] % 256)); $w.Write([byte]($p[0] % 256)); $w.Write([uint16]0)
      $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$p[1].Length); $w.Write([uint32]$off)
      $off += $p[1].Length
    }
    foreach ($p in $pngs) { $w.Write($p[1]) }
    $icons[$e] = $out.ToArray()
  }
  New-Item -ItemType Directory -Force $dir | Out-Null
  foreach ($e in $exts) { [IO.File]::WriteAllBytes("$dir\$e.ico", $icons[$e]) }
  foreach ($p in $progIds) {
    $e = ((Get-ItemProperty "$classes\$p").FileExtensions -split ';')[0]
    Set-ItemProperty "$classes\$p\DefaultIcon" -Name '(default)' -Value "$dir\$($e.TrimStart('.')).ico,0"
  }
  foreach ($p in $appx) {
    Remove-Item "$classes\$p\DefaultIcon" -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($e in $exts) {
      New-Item "$classes\SystemFileAssociations\.$e\DefaultIcon" -Force | Out-Null
      Set-ItemProperty "$classes\SystemFileAssociations\.$e\DefaultIcon" -Name '(default)' -Value "$dir\$e.ico,0"
    }
  }
  $missing = foreach ($e in $exts) {
    $sb = New-Object Text.StringBuilder 256
    [uint32]$n = 256
    [void][DocGeo.Shell]::AssocQueryString(0, 20, ".$e", $null, $sb, [ref]$n)
    if (@($progIds) + @($appx) -notcontains $sb.ToString()) { ".$e" }
  }
  [DocGeo.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
  Write-Host $msg[0]
  if ($missing) { Write-Host ($msg[3] -f ($missing -join ', ')) }
}
} @args
