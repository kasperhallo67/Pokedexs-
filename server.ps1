$port = 8765
$root = "C:\Users\Oddbjorn\pokemon-spill"
$scoresFile = Join-Path $root "scores.json"
$tradesFile = Join-Path $root "trades.json"
$usersFile   = Join-Path $root "users.json"
$battlesFile = Join-Path $root "battles.json"
$pokerFile   = Join-Path $root "poker.json"
$chatFile    = Join-Path $root "chat.json"
$listener = New-Object System.Net.HttpListener

$prefixes = @("http://localhost:$port/", "http://192.168.1.115:$port/")
foreach ($p in $prefixes) { $listener.Prefixes.Add($p) }

try {
  $listener.Start()
  Write-Host "Server kjorer paa:"
  foreach ($p in $prefixes) { Write-Host "  $p" }
} catch {
  Write-Host "FEIL ved oppstart: $_"
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$port/")
  $listener.Start()
}

if (-not (Test-Path $scoresFile)) {
  [System.IO.File]::WriteAllText($scoresFile, '{}', [System.Text.UTF8Encoding]::new($false))
}
if (-not (Test-Path $tradesFile)) {
  [System.IO.File]::WriteAllText($tradesFile, '[]', [System.Text.UTF8Encoding]::new($false))
}
if (-not (Test-Path $usersFile)) {
  [System.IO.File]::WriteAllText($usersFile, '{}', [System.Text.UTF8Encoding]::new($false))
}
if (-not (Test-Path $battlesFile)) {
  [System.IO.File]::WriteAllText($battlesFile, '[]', [System.Text.UTF8Encoding]::new($false))
}
if (-not (Test-Path $pokerFile)) {
  [System.IO.File]::WriteAllText($pokerFile, '{}', [System.Text.UTF8Encoding]::new($false))
}
if (-not (Test-Path $chatFile)) {
  [System.IO.File]::WriteAllText($chatFile, '[]', [System.Text.UTF8Encoding]::new($false))
}

function Read-PokerRooms {
  $rooms = @{}
  if (Test-Path $pokerFile) {
    try {
      $raw = [System.IO.File]::ReadAllText($pokerFile, [System.Text.UTF8Encoding]::new($false))
      if ($raw -and $raw.Trim()) {
        $parsed = $raw | ConvertFrom-Json
        foreach ($prop in $parsed.PSObject.Properties) {
          $rooms[$prop.Name] = "$($prop.Value)"
        }
      }
    } catch { Write-Host "Poker read err: $_" }
  }
  return $rooms
}

function Write-PokerRooms {
  param($rooms)
  $parts = @()
  foreach ($key in $rooms.Keys) {
    $val = $rooms[$key]
    $escaped = (($val -replace '\\','\\\\') -replace '"','\"') -replace "`n",'\n' -replace "`r",''
    $nameEscaped = (($key -replace '\\','\\\\') -replace '"','\"')
    $parts += "  `"$nameEscaped`": `"$escaped`""
  }
  $json = "{`n" + ($parts -join ",`n") + "`n}"
  [System.IO.File]::WriteAllText($pokerFile, $json, [System.Text.UTF8Encoding]::new($false))
}

function Process-Round {
  param($h)
  $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  $spamEnd = [int]$h.liveStart + 3000
  if ([int]$h.liveRound -eq 0) { return $h }
  if ($h.winner -ne "") { return $h }
  if ($now -lt $spamEnd) { return $h }

  $fromPresses = [int]$h.liveFromPresses
  $toPresses   = [int]$h.liveToPresses
  $fromDmg = $fromPresses * 2
  $toDmg   = $toPresses * 2
  $h.liveToHp   = [Math]::Max(0, [int]$h.liveToHp   - $fromDmg)
  $h.liveFromHp = [Math]::Max(0, [int]$h.liveFromHp - $toDmg)
  $h.log += "Runde $($h.liveRound): Fra=$fromPresses trykk ($fromDmg skade) - Til=$toPresses trykk ($toDmg skade)"

  if ([int]$h.liveFromHp -le 0 -and [int]$h.liveToHp -le 0) {
    if ($fromPresses -ge $toPresses) { $h.winner = "from" } else { $h.winner = "to" }
    $h.status = "accepted"
    $h.log += "Begge dor! Flest trykk vinner."
  } elseif ([int]$h.liveFromHp -le 0) {
    $h.winner = "to"
    $h.status = "accepted"
  } elseif ([int]$h.liveToHp -le 0) {
    $h.winner = "from"
    $h.status = "accepted"
  } else {
    # Neste runde
    $h.liveRound = [int]$h.liveRound + 1
    $h.liveStart = $now + 3000
    $h.liveFromPresses = 0
    $h.liveToPresses = 0
  }
  return $h
}

function Simulate-Battle {
  param([int]$fromPower, [int]$fromLvl, [int]$toPower, [int]$toLvl)
  $fromHp = $fromPower
  $toHp = $toPower
  $fromMult = 1.0 + ($fromLvl - 1) * 0.2
  $toMult   = 1.0 + ($toLvl   - 1) * 0.2
  $log = @()
  $rand = New-Object Random
  for ($i = 0; $i -lt 30; $i++) {
    if ($fromHp -le 0 -or $toHp -le 0) { break }
    $fromDmg = [Math]::Round(($rand.Next(8, 19)) * $fromMult)
    $toHp -= $fromDmg
    if ($toHp -le 0) {
      $log += "Du gjor $fromDmg skade. SEIER!"
      break
    }
    $log += "Du gjor $fromDmg skade ($toHp HP igjen)"
    $toDmg = [Math]::Round(($rand.Next(8, 19)) * $toMult)
    $fromHp -= $toDmg
    if ($fromHp -le 0) {
      $log += "Motstander gjor $toDmg skade. TAP!"
      break
    }
    $log += "Motstander gjor $toDmg skade ($fromHp HP igjen)"
  }
  $winner = if ($fromHp -gt 0) { "from" } else { "to" }
  return @{ winner = $winner; log = $log }
}

function Read-Users {
  param($file)
  $users = @{}
  if (Test-Path $file) {
    try {
      $raw = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
      if ($raw -and $raw.Trim()) {
        $parsed = $raw | ConvertFrom-Json
        foreach ($prop in $parsed.PSObject.Properties) {
          $u = $prop.Value
          $users[$prop.Name] = @{
            password = "$($u.password)"
            state    = if ($null -ne $u.state) { "$($u.state)" } else { $null }
          }
        }
      }
    } catch { Write-Host "Lese-feil users: $_" }
  }
  return $users
}

function Write-Users {
  param($file, $users)
  # Skriv som ren JSON med flat struktur per bruker
  $parts = @()
  foreach ($key in $users.Keys) {
    $u = $users[$key]
    $passEscaped = (($u.password -replace '\\','\\\\') -replace '"','\"') -replace "`n",'\n' -replace "`r",''
    $nameEscaped = (($key -replace '\\','\\\\') -replace '"','\"') -replace "`n",'\n' -replace "`r",''
    $statePart = if ($null -ne $u.state -and $u.state.Length -gt 0) {
      $stateEscaped = (($u.state -replace '\\','\\\\') -replace '"','\"') -replace "`n",'\n' -replace "`r",''
      "`"state`":`"$stateEscaped`""
    } else {
      "`"state`":null"
    }
    $parts += "  `"$nameEscaped`": { `"password`": `"$passEscaped`", $statePart }"
  }
  $json = "{`n" + ($parts -join ",`n") + "`n}"
  [System.IO.File]::WriteAllText($file, $json, [System.Text.UTF8Encoding]::new($false))
}

function Read-Json {
  param($file, $default)
  if (Test-Path $file) {
    try {
      $raw = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
      if ($raw -and $raw.Trim()) {
        return $raw | ConvertFrom-Json
      }
    } catch { Write-Host "Lese-feil ${file}: $_" }
  }
  return $default
}

function Write-Json {
  param($file, $obj, [switch]$AsArray)
  if ($AsArray) {
    # Tving array-serialisering selv for tom/single-item liste
    if ($null -eq $obj -or $obj.Count -eq 0) {
      $json = '[]'
    } else {
      # Bygg JSON manuelt for hver hashtable så vi unngår PS sin "value/Count"-wrapping
      $parts = @()
      foreach ($item in @($obj)) {
        $parts += ($item | ConvertTo-Json -Depth 10 -Compress:$false)
      }
      $json = "[`n" + ($parts -join ",`n") + "`n]"
    }
  } else {
    $json = $obj | ConvertTo-Json -Depth 10
  }
  [System.IO.File]::WriteAllText($file, $json, [System.Text.UTF8Encoding]::new($false))
}

function To-Hashtable {
  param($psObj)
  if ($null -eq $psObj) { return @{} }
  $h = @{}
  foreach ($prop in $psObj.PSObject.Properties) {
    $h[$prop.Name] = $prop.Value
  }
  return $h
}

function Send-Json {
  param($res, $obj, [int]$status = 200)
  $json = if ($obj -is [string]) { $obj } else { $obj | ConvertTo-Json -Depth 10 }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $res.StatusCode = $status
  $res.ContentType = "application/json; charset=utf-8"
  $res.Headers.Add("Access-Control-Allow-Origin", "*")
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Read-Body {
  param($req)
  $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
  $body = $reader.ReadToEnd()
  $reader.Close()
  return $body | ConvertFrom-Json
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = $req.Url.LocalPath
    $method = $req.HttpMethod

    if ($path -eq "/api/score" -and $method -eq "POST") {
      $data = Read-Body $req
      $username = "$($data.username)".Trim()
      if ($username -and $username.Length -le 30) {
        $scoresObj = Read-Json $scoresFile @{}
        $scores = @{}
        foreach ($prop in $scoresObj.PSObject.Properties) {
          $scores[$prop.Name] = $prop.Value
        }
        $scores[$username] = @{
          totalCaught = [int]$data.totalCaught
          shinies     = [int]$data.shinies
          uniqueSeen  = [int]$data.uniqueSeen
          coins       = [int]$data.coins
          lastUpdated = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        }
        Write-Json $scoresFile $scores
        Send-Json $res @{ ok = $true }
      } else {
        Send-Json $res @{ ok = $false; error = "ugyldig brukernavn" } 400
      }
    }
    elseif ($path -eq "/api/leaderboard" -and $method -eq "GET") {
      $scores = Read-Json $scoresFile @{}
      Send-Json $res $scores
    }
    elseif ($path -eq "/api/trade/send" -and $method -eq "POST") {
      $data = Read-Body $req
      $from = "$($data.from)".Trim()
      $to = "$($data.to)".Trim()
      if (-not $from -or -not $to -or $from -eq $to) {
        Send-Json $res @{ ok = $false; error = "ugyldige brukernavn" } 400
      } else {
        $rawTrades = Read-Json $tradesFile @()
        $trades = @()
        foreach ($t in @($rawTrades)) {
          if ($t -and $t.id) { $trades += To-Hashtable $t }
        }
        $newTrade = @{
          id         = [Guid]::NewGuid().ToString()
          from       = $from
          to         = $to
          offerId    = [int]$data.offerId
          offerName  = "$($data.offerName)"
          offerShiny = [bool]$data.offerShiny
          wantId     = [int]$data.wantId
          wantName   = "$($data.wantName)"
          wantShiny  = [bool]$data.wantShiny
          status     = "pending"
          created    = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        }
        $trades += $newTrade
        Write-Json $tradesFile $trades -AsArray
        Send-Json $res @{ ok = $true; trade = $newTrade }
      }
    }
    elseif ($path -eq "/api/trade/inbox" -and $method -eq "GET") {
      $user = "$($req.QueryString['username'])".Trim()
      $rawTrades = Read-Json $tradesFile @()
      $inbox = @()
      foreach ($t in @($rawTrades)) {
        if ($t -and $t.id -and ($t.to -eq $user -or $t.from -eq $user)) {
          $inbox += To-Hashtable $t
        }
      }
      # Send som ren array via manuell JSON
      if ($inbox.Count -eq 0) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('[]')
      } else {
        $parts = @()
        foreach ($t in $inbox) { $parts += ($t | ConvertTo-Json -Depth 5) }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("[`n" + ($parts -join ",`n") + "`n]")
      }
      $res.StatusCode = 200
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    elseif ($path -eq "/api/trade/respond" -and $method -eq "POST") {
      $data = Read-Body $req
      $tradeId = "$($data.id)"
      $action  = "$($data.action)"
      $username = "$($data.username)".Trim()
      $rawTrades = Read-Json $tradesFile @()
      $found = $null
      $newTrades = @()
      foreach ($t in @($rawTrades)) {
        if (-not $t -or -not $t.id) { continue }
        $h = To-Hashtable $t
        if ($h.id -eq $tradeId -and $h.to -eq $username -and $h.status -eq "pending") {
          $h.status = if ($action -eq "accept") { "accepted" } else { "declined" }
          $found = $h
        }
        $newTrades += $h
      }
      if ($found) {
        Write-Json $tradesFile $newTrades -AsArray
        Send-Json $res @{ ok = $true; trade = $found }
      } else {
        Send-Json $res @{ ok = $false; error = "trade ikke funnet" } 404
      }
    }
    elseif ($path -eq "/api/trade/ack" -and $method -eq "POST") {
      $data = Read-Body $req
      $tradeId = "$($data.id)"
      $rawTrades = Read-Json $tradesFile @()
      $newTrades = @()
      foreach ($t in @($rawTrades)) {
        if (-not $t -or -not $t.id) { continue }
        $h = To-Hashtable $t
        if ($h.id -ne $tradeId) { $newTrades += $h }
      }
      Write-Json $tradesFile $newTrades -AsArray
      Send-Json $res @{ ok = $true }
    }
    elseif ($path -eq "/api/battle/send" -and $method -eq "POST") {
      $data = Read-Body $req
      $from = "$($data.from)".Trim()
      $to   = "$($data.to)".Trim()
      $bet  = [int]$data.bet
      if (-not $from -or -not $to -or $from -eq $to -or $bet -lt 1) {
        Send-Json $res @{ ok = $false; error = "Ugyldige verdier" } 400
      } else {
        $rawBattles = Read-Json $battlesFile @()
        $battles = @()
        foreach ($b in @($rawBattles)) {
          if ($b -and $b.id) { $battles += To-Hashtable $b }
        }
        $newBattle = @{
          id              = [Guid]::NewGuid().ToString()
          from            = $from
          to              = $to
          bet             = $bet
          fromPokeId      = [int]$data.fromPokeId
          fromPokeName    = "$($data.fromPokeName)"
          fromPokeLevel   = [int]$data.fromPokeLevel
          fromPokePower   = [int]$data.fromPokePower
          toPokeId        = 0
          toPokeName      = ""
          toPokeLevel     = 0
          toPokePower     = 0
          status          = "pending"
          winner          = ""
          log             = @()
          fromAck         = $false
          toAck           = $false
          created         = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        }
        $battles += $newBattle
        Write-Json $battlesFile $battles -AsArray
        Send-Json $res @{ ok = $true; battle = $newBattle }
      }
    }
    elseif ($path -eq "/api/battle/inbox" -and $method -eq "GET") {
      $user = "$($req.QueryString['username'])".Trim()
      $rawBattles = Read-Json $battlesFile @()
      $inbox = @()
      foreach ($b in @($rawBattles)) {
        if ($b -and $b.id -and ($b.to -eq $user -or $b.from -eq $user)) {
          $inbox += To-Hashtable $b
        }
      }
      if ($inbox.Count -eq 0) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('[]')
      } else {
        $parts = @()
        foreach ($b in $inbox) { $parts += ($b | ConvertTo-Json -Depth 5) }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("[`n" + ($parts -join ",`n") + "`n]")
      }
      $res.StatusCode = 200
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    elseif ($path -eq "/api/battle/respond" -and $method -eq "POST") {
      $data = Read-Body $req
      $battleId = "$($data.id)"
      $action   = "$($data.action)"
      $username = "$($data.username)".Trim()
      $rawBattles = Read-Json $battlesFile @()
      $found = $null
      $newBattles = @()
      foreach ($b in @($rawBattles)) {
        if (-not $b -or -not $b.id) { continue }
        $h = To-Hashtable $b
        if ($h.id -eq $battleId -and $h.to -eq $username -and $h.status -eq "pending") {
          if ($action -eq "accept") {
            $h.toPokeId    = [int]$data.toPokeId
            $h.toPokeName  = "$($data.toPokeName)"
            $h.toPokeLevel = [int]$data.toPokeLevel
            $h.toPokePower = [int]$data.toPokePower
            $h.status      = "live"
            # Live spam-battle state
            $h.liveFromHp       = $h.fromPokePower
            $h.liveToHp         = $h.toPokePower
            # Start runde 1 med 6 sekunders countdown - nok tid for sender å bli med
            $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            $h.liveRound        = 1
            $h.liveStart        = $now + 6000
            $h.liveFromPresses  = 0
            $h.liveToPresses    = 0
            $h.fromReady        = $true
            $h.toReady          = $true
            $h.winner           = ""
            $h.log              = @()
          } else {
            $h.status = "declined"
          }
          $found = $h
        }
        $newBattles += $h
      }
      if ($found) {
        Write-Json $battlesFile $newBattles -AsArray
        Send-Json $res @{ ok = $true; battle = $found }
      } else {
        Send-Json $res @{ ok = $false; error = "kamp ikke funnet" } 404
      }
    }
    elseif ($path -eq "/api/battle/ready" -and $method -eq "POST") {
      $data = Read-Body $req
      $battleId = "$($data.id)"
      $username = "$($data.username)".Trim()
      $rawBattles = Read-Json $battlesFile @()
      $found = $null
      $newBattles = @()
      foreach ($b in @($rawBattles)) {
        if (-not $b -or -not $b.id) { continue }
        $h = To-Hashtable $b
        if ($h.id -eq $battleId) {
          if ($h.from -eq $username) { $h.fromReady = $true }
          if ($h.to   -eq $username) { $h.toReady   = $true }
          if ($h.fromReady -and $h.toReady -and [int]$h.liveRound -eq 0) {
            $h.liveRound = 1
            $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            $h.liveStart = $now + 3000   # 3s countdown deretter 3s spam
            $h.liveFromPresses = 0
            $h.liveToPresses = 0
          }
          $h = Process-Round $h
          $found = $h
        }
        $newBattles += $h
      }
      if ($found) {
        Write-Json $battlesFile $newBattles -AsArray
        Send-Json $res @{ ok = $true; battle = $found }
      } else {
        Send-Json $res @{ ok = $false; error = "ikke funnet" } 404
      }
    }
    elseif ($path -eq "/api/battle/live" -and $method -eq "GET") {
      $battleId = "$($req.QueryString['id'])"
      $rawBattles = Read-Json $battlesFile @()
      $found = $null
      $newBattles = @()
      foreach ($b in @($rawBattles)) {
        if (-not $b -or -not $b.id) { $newBattles += $b; continue }
        $h = To-Hashtable $b
        if ($h.id -eq $battleId) {
          $h = Process-Round $h
          $found = $h
        }
        $newBattles += $h
      }
      Write-Json $battlesFile $newBattles -AsArray
      if ($found) {
        $found.serverNow = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        Send-Json $res $found
      } else { Send-Json $res @{ error = "ikke funnet" } 404 }
    }
    elseif ($path -eq "/api/battle/press" -and $method -eq "POST") {
      $data = Read-Body $req
      $battleId = "$($data.id)"
      $username = "$($data.username)".Trim()
      $delta    = [int]$data.delta
      $rawBattles = Read-Json $battlesFile @()
      $found = $null
      $newBattles = @()
      foreach ($b in @($rawBattles)) {
        if (-not $b -or -not $b.id) { $newBattles += $b; continue }
        $h = To-Hashtable $b
        if ($h.id -eq $battleId) {
          # Tell trykk i hele runden (ikke bare spam-vinduet) for å unngå timing-problemer
          if ([int]$h.liveRound -gt 0 -and $h.winner -eq "") {
            if ($h.from -eq $username) { $h.liveFromPresses = [int]$h.liveFromPresses + $delta }
            if ($h.to   -eq $username) { $h.liveToPresses   = [int]$h.liveToPresses   + $delta }
          }
          $h = Process-Round $h
          $found = $h
        }
        $newBattles += $h
      }
      Write-Json $battlesFile $newBattles -AsArray
      if ($found) { Send-Json $res @{ ok = $true; battle = $found } }
      else { Send-Json $res @{ ok = $false; error = "ikke funnet" } 404 }
    }
    elseif ($path -eq "/api/battle/cancel" -and $method -eq "POST") {
      $data = Read-Body $req
      $battleId = "$($data.id)"
      $username = "$($data.username)".Trim()
      $rawBattles = Read-Json $battlesFile @()
      $newBattles = @()
      foreach ($b in @($rawBattles)) {
        if (-not $b -or -not $b.id) { continue }
        $h = To-Hashtable $b
        # Sender kan kansellere kun sine egne pending invitasjoner
        if ($h.id -eq $battleId -and $h.from -eq $username -and $h.status -eq "pending") {
          continue  # hopp over - dvs fjern
        }
        $newBattles += $h
      }
      Write-Json $battlesFile $newBattles -AsArray
      Send-Json $res @{ ok = $true }
    }
    elseif ($path -eq "/api/battle/ack" -and $method -eq "POST") {
      $data = Read-Body $req
      $battleId = "$($data.id)"
      $username = "$($data.username)".Trim()
      $rawBattles = Read-Json $battlesFile @()
      $newBattles = @()
      foreach ($b in @($rawBattles)) {
        if (-not $b -or -not $b.id) { continue }
        $h = To-Hashtable $b
        if ($h.id -eq $battleId) {
          if ($h.from -eq $username) { $h.fromAck = $true }
          if ($h.to -eq $username)   { $h.toAck = $true }
          # Fjern kun hvis begge har ack-et eller den ble declined
          if (($h.fromAck -and $h.toAck) -or $h.status -eq "declined") {
            continue
          }
        }
        $newBattles += $h
      }
      Write-Json $battlesFile $newBattles -AsArray
      Send-Json $res @{ ok = $true }
    }
    elseif ($path -eq "/api/poker/create" -and $method -eq "POST") {
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $username = "$($data.username)".Trim()
      $bet = [int]$data.bet
      $maxPlayers = [int]$data.maxPlayers
      if (-not $code -or -not $username -or $bet -lt 10 -or $maxPlayers -lt 2 -or $maxPlayers -gt 5) {
        Send-Json $res @{ ok = $false; error = "Invalid values" } 400
      } else {
        $rooms = Read-PokerRooms
        if ($rooms.ContainsKey($code)) {
          Send-Json $res @{ ok = $false; error = "Code already in use" } 409
        } else {
          $room = @{
            code        = $code
            creator     = $username
            bet         = $bet
            maxPlayers  = $maxPlayers
            status      = "lobby"
            players     = @($username)
            pot         = 0
            phase       = ""
            seed        = 0
            discards    = @{}
            startedAt   = ""
            created     = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
          }
          $rooms[$code] = ($room | ConvertTo-Json -Depth 10 -Compress)
          Write-PokerRooms $rooms
          Send-Json $res @{ ok = $true; room = $room }
        }
      }
    }
    elseif ($path -eq "/api/poker/join" -and $method -eq "POST") {
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $username = "$($data.username)".Trim()
      $rooms = Read-PokerRooms
      if (-not $rooms.ContainsKey($code)) {
        Send-Json $res @{ ok = $false; error = "Room not found" } 404
      } else {
        $room = $rooms[$code] | ConvertFrom-Json
        if ($room.status -ne "lobby") {
          Send-Json $res @{ ok = $false; error = "Game already started" } 400
        } else {
          $players = @($room.players)
          if ($players.Count -ge $room.maxPlayers) {
            Send-Json $res @{ ok = $false; error = "Room is full" } 400
          } elseif ($players -contains $username) {
            Send-Json $res @{ ok = $true; room = $room }
          } else {
            $room.players = $players + @($username)
            $rooms[$code] = ($room | ConvertTo-Json -Depth 10 -Compress)
            Write-PokerRooms $rooms
            Send-Json $res @{ ok = $true; room = $room }
          }
        }
      }
    }
    elseif ($path -eq "/api/poker/advance" -and $method -eq "POST") {
      # Texas-spesifikt: alle markerer "ready" for neste community-card
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $username = "$($data.username)".Trim()
      $rooms = Read-PokerRooms
      if (-not $rooms.ContainsKey($code)) {
        Send-Json $res @{ ok = $false; error = "Room not found" } 404
      } else {
        $room = $rooms[$code] | ConvertFrom-Json
        # Behandle som ready-signal i discards-hashmap
        $discardsHash = @{}
        if ($room.discards) {
          foreach ($prop in $room.discards.PSObject.Properties) {
            $discardsHash[$prop.Name] = @($prop.Value)
          }
        }
        $discardsHash[$username] = @()
        # Auto-ready bots
        foreach ($p in $room.players) {
          if ($p -like "Bot *" -and -not $discardsHash.ContainsKey($p)) {
            $discardsHash[$p] = @()
          }
        }
        $allReady = $true
        foreach ($p in $room.players) {
          if (-not $discardsHash.ContainsKey($p)) { $allReady = $false }
        }
        if ($allReady) {
          $currentRound = if ($room.round) { [int]$room.round } else { 0 }
          if ($currentRound -ge 5) {
            $room.phase = "showdown"
          } else {
            $room.round = $currentRound + 1
            $discardsHash = @{}  # reset
          }
        }
        $room.discards = $discardsHash
        $rooms[$code] = ($room | ConvertTo-Json -Depth 10 -Compress)
        Write-PokerRooms $rooms
        Send-Json $res @{ ok = $true; room = $room }
      }
    }
    elseif ($path -eq "/api/poker/start" -and $method -eq "POST") {
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $username = "$($data.username)".Trim()
      $fillBots = [bool]$data.fillWithBots
      $rooms = Read-PokerRooms
      if (-not $rooms.ContainsKey($code)) {
        Send-Json $res @{ ok = $false; error = "Room not found" } 404
      } else {
        $room = $rooms[$code] | ConvertFrom-Json
        if ($room.creator -ne $username) {
          Send-Json $res @{ ok = $false; error = "Only creator can start" } 403
        } elseif ($room.status -ne "lobby") {
          Send-Json $res @{ ok = $false; error = "Already started" } 400
        } else {
          $players = @($room.players)
          if ($fillBots) {
            $botNames = @("Bot Alice", "Bot Bob", "Bot Carol", "Bot Dave")
            $idx = 0
            while ($players.Count -lt $room.maxPlayers -and $idx -lt $botNames.Count) {
              $players += $botNames[$idx]
              $idx++
            }
          }
          if ($players.Count -lt 2) {
            Send-Json $res @{ ok = $false; error = "Need at least 2 players (use bots to fill)" } 400
          } else {
            $room.players  = $players
            $room.status   = "playing"
            $room.phase    = "discard"
            $room.seed     = (Get-Random -Maximum 999999999)
            $room.pot      = [int]$room.bet * $players.Count
            $room.discards = @{}
            $room.round    = 0
            $room.startedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
            $rooms[$code] = ($room | ConvertTo-Json -Depth 10 -Compress)
            Write-PokerRooms $rooms
            Send-Json $res @{ ok = $true; room = $room }
          }
        }
      }
    }
    elseif ($path -eq "/api/poker/room" -and $method -eq "GET") {
      $code = "$($req.QueryString['code'])".Trim().ToUpper()
      $rooms = Read-PokerRooms
      if (-not $rooms.ContainsKey($code)) {
        Send-Json $res @{ ok = $false; error = "Room not found" } 404
      } else {
        $room = $rooms[$code] | ConvertFrom-Json
        Send-Json $res @{ ok = $true; room = $room }
      }
    }
    elseif ($path -eq "/api/poker/discard" -and $method -eq "POST") {
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $username = "$($data.username)".Trim()
      $indices = @($data.indices)
      $rooms = Read-PokerRooms
      if (-not $rooms.ContainsKey($code)) {
        Send-Json $res @{ ok = $false; error = "Room not found" } 404
      } else {
        $room = $rooms[$code] | ConvertFrom-Json
        if ($room.phase -ne "discard") {
          Send-Json $res @{ ok = $false; error = "Not in discard phase" } 400
        } else {
          $discardsHash = @{}
          if ($room.discards) {
            foreach ($prop in $room.discards.PSObject.Properties) {
              $discardsHash[$prop.Name] = @($prop.Value)
            }
          }
          $discardsHash[$username] = $indices
          # Auto-discard for bots (0-3 tilfeldig)
          $rand = New-Object Random
          foreach ($p in $room.players) {
            if ($p -like "Bot *" -and -not $discardsHash.ContainsKey($p)) {
              $num = $rand.Next(0, 4)
              if ($num -eq 0) {
                $discardsHash[$p] = @()
              } else {
                $picks = @()
                $available = 0..4 | Get-Random -Count $num
                foreach ($pi in $available) { $picks += [int]$pi }
                $discardsHash[$p] = $picks
              }
            }
          }
          # Sjekk om alle har submitted
          $allSubmitted = $true
          foreach ($p in $room.players) {
            if (-not $discardsHash.ContainsKey($p)) { $allSubmitted = $false }
          }
          $room.discards = $discardsHash
          if ($allSubmitted) { $room.phase = "showdown" }
          $rooms[$code] = ($room | ConvertTo-Json -Depth 10 -Compress)
          Write-PokerRooms $rooms
          Send-Json $res @{ ok = $true; room = $room }
        }
      }
    }
    elseif ($path -eq "/api/poker/leave" -and $method -eq "POST") {
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $username = "$($data.username)".Trim()
      $rooms = Read-PokerRooms
      if ($rooms.ContainsKey($code)) {
        $room = $rooms[$code] | ConvertFrom-Json
        if ($room.status -eq "lobby") {
          $room.players = @(@($room.players) | Where-Object { $_ -ne $username })
          if ($room.players.Count -eq 0) {
            $rooms.Remove($code)
          } else {
            if ($room.creator -eq $username) { $room.creator = $room.players[0] }
            $rooms[$code] = ($room | ConvertTo-Json -Depth 10 -Compress)
          }
          Write-PokerRooms $rooms
        }
      }
      Send-Json $res @{ ok = $true }
    }
    elseif ($path -eq "/api/poker/close" -and $method -eq "POST") {
      $data = Read-Body $req
      $code = "$($data.code)".Trim().ToUpper()
      $rooms = Read-PokerRooms
      if ($rooms.ContainsKey($code)) {
        $rooms.Remove($code)
        Write-PokerRooms $rooms
      }
      Send-Json $res @{ ok = $true }
    }
    elseif ($path -eq "/api/account/create" -and $method -eq "POST") {
      $data = Read-Body $req
      $username = "$($data.username)".Trim()
      $password = "$($data.password)"
      if (-not $username -or $username.Length -gt 30 -or $password.Length -lt 3) {
        Send-Json $res @{ ok = $false; error = "Ugyldig brukernavn eller passord" } 400
      } else {
        $users = Read-Users $usersFile
        if ($users.ContainsKey($username)) {
          Send-Json $res @{ ok = $false; error = "Brukernavn finnes allerede" } 409
        } else {
          $users[$username] = @{ password = $password; state = $null }
          Write-Users $usersFile $users
          Send-Json $res @{ ok = $true }
        }
      }
    }
    elseif ($path -eq "/api/account/login" -and $method -eq "POST") {
      $data = Read-Body $req
      $username = "$($data.username)".Trim()
      $password = "$($data.password)"
      $users = Read-Users $usersFile
      if (-not $users.ContainsKey($username)) {
        Send-Json $res @{ ok = $false; error = "Brukernavn finnes ikke" } 404
      } elseif ($users[$username].password -ne $password) {
        Send-Json $res @{ ok = $false; error = "Feil passord" } 401
      } else {
        Send-Json $res @{ ok = $true; state = $users[$username].state }
      }
    }
    elseif ($path -eq "/api/account/sync" -and $method -eq "POST") {
      $data = Read-Body $req
      $username = "$($data.username)".Trim()
      $password = "$($data.password)"
      $stateJson = "$($data.state)"
      $users = Read-Users $usersFile
      if (-not $users.ContainsKey($username)) {
        # Auto-registrer hvis ikke finnes
        $users[$username] = @{ password = $password; state = $stateJson }
        Write-Users $usersFile $users
        Send-Json $res @{ ok = $true; created = $true }
      } elseif ($users[$username].password -ne $password) {
        Send-Json $res @{ ok = $false; error = "Feil passord" } 401
      } else {
        $users[$username].state = $stateJson
        Write-Users $usersFile $users
        Send-Json $res @{ ok = $true }
      }
    }
    elseif ($path -eq "/api/chat/send" -and $method -eq "POST") {
      $data = Read-Body $req
      $username = "$($data.username)".Trim()
      $message  = "$($data.message)".Trim()
      if (-not $username -or -not $message) {
        Send-Json $res @{ ok = $false; error = "Missing fields" } 400
      } else {
        if ($username.Length -gt 30) { $username = $username.Substring(0, 30) }
        if ($message.Length -gt 500)  { $message  = $message.Substring(0, 500) }
        $raw = @(Read-Json $chatFile @())
        $messages = @()
        foreach ($m in $raw) {
          if ($m -and $m.id) { $messages += To-Hashtable $m }
        }
        $newMsg = @{
          id = [Guid]::NewGuid().ToString()
          username = $username
          message = $message
          time = (Get-Date).ToString("o")
        }
        $messages += $newMsg
        if ($messages.Count -gt 100) {
          $messages = $messages[($messages.Count - 100)..($messages.Count - 1)]
        }
        Write-Json $chatFile $messages -AsArray
        Send-Json $res @{ ok = $true }
      }
    }
    elseif ($path -eq "/api/chat/messages" -and $method -eq "GET") {
      $raw = @(Read-Json $chatFile @())
      if ($raw.Count -eq 0) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('[]')
      } else {
        $parts = @()
        foreach ($m in $raw) {
          if ($m -and $m.id) {
            $h = To-Hashtable $m
            $parts += ($h | ConvertTo-Json -Depth 3)
          }
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("[`n" + ($parts -join ",`n") + "`n]")
      }
      $res.StatusCode = 200
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    elseif ($path -like "/api/*" -and $method -eq "OPTIONS") {
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
      $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
      $res.StatusCode = 200
    }
    else {
      if ($path -eq "/") { $path = "/index.html" }
      $file = Join-Path $root $path.TrimStart("/")
      if (Test-Path $file -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        switch ($ext) {
          ".html" { $res.ContentType = "text/html; charset=utf-8" }
          ".css"  { $res.ContentType = "text/css" }
          ".js"   { $res.ContentType = "application/javascript" }
          ".png"  { $res.ContentType = "image/png" }
          ".json" { $res.ContentType = "application/json" }
          default { $res.ContentType = "application/octet-stream" }
        }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
      }
    }
    $res.OutputStream.Close()
  } catch {
    Write-Host "Feil: $_"
    try { $res.OutputStream.Close() } catch {}
  }
}
