$h = "SHA256:WE4WFB/trd2nfBOHjShT+kl41VmZLmN1WHc/z7nXSyY"
$pw = "Moh97@@@@@@@"
$ip = "root@187.124.163.184"

function Run-SSH {
    param([string]$cmd, [int]$timeout = 30000)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "C:\Windows\Temp\plink.exe"
    $psi.Arguments = "-ssh -pw `"$pw`" -hostkey `"$h`" -batch $ip `"$cmd`""
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow  = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $out = $p.StandardOutput.ReadToEnd()
    $err = $p.StandardError.ReadToEnd()
    $p.WaitForExit($timeout)
    if ($out) { Write-Host $out }
    if ($err -and $err -notmatch "^(Access granted|Authenticated)" ) { Write-Host "ERR: $err" }
    return $out
}

Write-Host "=== Step 1: Installing MongoDB ==="
$installMongo = "export DEBIAN_FRONTEND=noninteractive && curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor 2>/dev/null && echo 'deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse' > /etc/apt/sources.list.d/mongodb-org-8.0.list && apt-get update -qq 2>/dev/null && apt-get install -y mongodb-org 2>&1 | grep -E '(Unpacking mongodb|Setting up mongodb|error)' ; systemctl start mongod ; systemctl enable mongod ; mongod --version 2>&1 | head -1 ; systemctl is-active mongod"
Run-SSH $installMongo -timeout 300000
