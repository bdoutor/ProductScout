$body = @{ query = "filtro" } | ConvertTo-Json
$res = Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/search -ContentType 'application/json' -Body $body
$res.items | Where-Object { $_.store -eq 'Nipocar' } | Select-Object code, price | ConvertTo-Json -Depth 3
