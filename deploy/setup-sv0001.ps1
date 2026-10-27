# Instalação única no servidor (SERVER/sv0001), no mesmo padrão do Painel CEO. O .env (segredos) é copiado à parte.
$ErrorActionPreference = 'Stop'
$base = 'C:\Mentor-IA'; $app = "$base\app"
New-Item -ItemType Directory -Force $base, "$base\data" | Out-Null
git config --system --add safe.directory C:/Mentor-IA/app
if (-not (Test-Path "$app\.git")) { git clone -q https://github.com/LucasAraujoD3V/mentor-ia.git $app }
Set-Content "$base\start.bat" -Encoding ascii -Value "@echo off`r`ncd /d $app`r`n`"C:\Program Files\nodejs\node.exe`" --env-file=$base\.env server\index.mjs >> $base\server.log 2>&1"
New-Item -ItemType File -Force "$base\server.log" | Out-Null
# Conta SERVIÇO LOCAL: lê o código, escreve só no banco e no log; o .env fica fechado.
icacls $base /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
icacls "$base\data" /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
icacls "$base\server.log" /grant '*S-1-5-19:M' | Out-Null
icacls "$base\.env" /inheritance:r /grant '*S-1-5-19:R' '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
$config = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'Mentor-IA' -Action (New-ScheduledTaskAction -Execute "$base\start.bat") -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $config -User 'NT AUTHORITY\LOCAL SERVICE' -Force | Out-Null
Register-ScheduledTask -TaskName 'Mentor-IA-AutoDeploy' -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File $app\deploy\autodeploy.ps1") -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 2)) -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Start-ScheduledTask 'Mentor-IA'
