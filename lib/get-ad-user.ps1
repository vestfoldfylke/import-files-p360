#Requires -Modules ActiveDirectory
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Email,
  [Parameter(Mandatory)][ValidateSet('VFYLKE', 'TFYLKE')][string]$CountyOU,
  [Parameter(Mandatory)][ValidateSet('AUTO USERS', 'AUTO DISABLED USERS', 'MANUAL USERS')][string]$UsersOU,
  [Parameter(Mandatory)][ValidateSet('login', 'skole')][string]$Domain
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$searchBase = "OU=$UsersOU,OU=USERS,OU=$CountyOU,DC=$Domain,DC=top,DC=no"

Get-ADUser `
  -SearchBase $searchBase `
  -Filter { EmailAddress -eq $Email } `
  -Properties DisplayName, Company |
  Select-Object DisplayName, Company |
  ConvertTo-Json -Depth 20
