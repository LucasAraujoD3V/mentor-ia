# Roda no servidor a cada 2 min (tarefa Mentor-IA-AutoDeploy): publica commit novo da main e reinicia o app.
$app = 'C:\Mentor-IA\app'; $log = 'C:\Mentor-IA\autodeploy.log'
Set-Location $app
git fetch -q origin main 2>$null
if ((git rev-parse HEAD) -eq (git rev-parse origin/main)) { exit 0 }
git reset -q --hard origin/main
Stop-ScheduledTask 'Mentor-IA'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -like '*Mentor-IA*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-ScheduledTask 'Mentor-IA'
Add-Content $log "$(Get-Date -Format s) publicado $(git rev-parse --short HEAD)"
