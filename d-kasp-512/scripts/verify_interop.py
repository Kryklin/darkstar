import subprocess
import json
import sys
import os
import shutil
import time
import platform
try:
    import psutil
except ImportError:
    psutil = None

from rich.console import Console
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich import box

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["go", "rust", "python", "node"]

GO_BIN = shutil.which("go") or r"C:\Program Files\Go\bin\go.exe"
CARGO_BIN = shutil.which("cargo") or "cargo"
PYTHON_BIN = shutil.which("python") or "python"
NODE_BIN = shutil.which("node") or "node"

CLI_COMMANDS = {
    "go": [GO_BIN, "run", "."],
    "rust": [os.path.join(PROJECT_ROOT, "rust", "target", "release", "d-kasp-512.exe")],
    "python": [PYTHON_BIN, "-u", os.path.join(PROJECT_ROOT, "python", "darkstar_crypt.py")],
    "python_old": [PYTHON_BIN, "-u", os.path.join(PROJECT_ROOT, "python", "darkstar_crypt_old.py")],
    "node": [NODE_BIN, os.path.join(PROJECT_ROOT, "node", "darkstar_crypt.js")]
}

CLI_CWD = {
    "go": os.path.join(PROJECT_ROOT, "go"),
    "rust": PROJECT_ROOT,
    "python": PROJECT_ROOT,
    "python_old": PROJECT_ROOT,
    "node": PROJECT_ROOT
}

TEST_MNEMONIC = "apple banana cherry date elderberry fig grape honeydew"
TEST_PASSWORD = "Strong!Password#2026"
TOTAL_EXPECTED_TESTS = 16 # 1 version * 4 langs * 4 langs

def get_sys_info():
    uname = platform.uname()
    ram_gb = "N/A"
    cpu_freq = "N/A"
    if psutil:
        mem = psutil.virtual_memory()
        ram_gb = f"{mem.total / (1024**3):.1f} GB"
        try:
            freq = psutil.cpu_freq()
            cpu_freq = f"{freq.max:.0f}Mhz" if freq else "N/A"
        except:
            pass
            
    table = Table(box=box.SIMPLE_HEAVY, expand=True)
    table.add_column("Property", style="#888888")
    table.add_column("Value", style="#aaaaaa")
    table.add_row("OS", f"{uname.system} {uname.release} ({uname.machine})")
    table.add_row("Processor", f"{uname.processor} @ {cpu_freq}")
    table.add_row("System RAM", ram_gb)
    table.add_row("Python Ver.", platform.python_version())
    return Panel(table, title="[bold #cccccc][ DARKSTAR // HOST TELEMETRY ][/bold #cccccc]", border_style="#555555")

def run_cli(lang, args):
    str_args = []
    for a in args:
        if isinstance(a, (dict, list)):
            str_args.append(json.dumps(a))
        else:
            str_args.append(str(a))
            
    cmd = CLI_COMMANDS[lang] + str_args
    cwd = CLI_CWD.get(lang, PROJECT_ROOT)
    
    start_time = time.perf_counter()
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, encoding="utf-8", errors="replace")
    elapsed = time.perf_counter() - start_time
    
    if result.returncode != 0:
        return f"ERROR: {result.stderr.strip()}", elapsed
    return result.stdout.strip(), elapsed


console = Console()

def main():
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=8),
        Layout(name="dashboard", size=6)
    )
    
    total_tests = 0
    passed_tests = 0
    errors = []
    start_suite = time.perf_counter()
    current_action = "STANDBY"
    action_start_time = time.perf_counter()
    current_version_int = 5

    def generate_dashboard():
        t = Table(expand=True, box=box.HEAVY, border_style="#555555")
        t.add_column("PROGRESS", justify="center", style="#888888", width=14)
        t.add_column("PASS", justify="center", style="#888888", width=12)
        t.add_column("OPERATION", justify="center", style="#888888", ratio=1)
        t.add_column("PROTOCOL", justify="center", style="#888888", width=16)
        t.add_column("UPTIME", justify="center", style="#888888", width=12)
        
        uptime_s = time.perf_counter() - start_suite
        uptime = f"{uptime_s:.2f}s"
        
        # Reactive progress: dim -> bright white as tests complete
        pct = total_tests / TOTAL_EXPECTED_TESTS if TOTAL_EXPECTED_TESTS else 0
        if pct < 0.25:
            prog_color = "#666666"
        elif pct < 0.5:
            prog_color = "#999999"
        elif pct < 0.75:
            prog_color = "#bbbbbb"
        else:
            prog_color = "#ffffff"
        progress_str = f"[{prog_color}]{total_tests} / {TOTAL_EXPECTED_TESTS}[/{prog_color}]"
        
        # Reactive pass: green tint scales with count
        if passed_tests == 0:
            pass_str = f"[#666666]{passed_tests}[/#666666]"
        elif passed_tests < TOTAL_EXPECTED_TESTS:
            pass_str = f"[#5faf5f]{passed_tests}[/#5faf5f]"
        else:
            pass_str = f"[#87d787]{passed_tests}[/#87d787]"
        
        # Protocol bar: cyan pips
        filled = "|" * current_version_int
        empty = "." * (5 - current_version_int)
        version_bar = f"[#5fafaf]{filled}[/#5fafaf][#444444]{empty}[/#444444] [#5fafaf]V{current_version_int}[/#5fafaf]"
        
        # Reactive uptime: warm shift over time
        if uptime_s < 10:
            up_color = "#888888"
        elif uptime_s < 30:
            up_color = "#d7af5f"
        else:
            up_color = "#d78700"
        uptime_str = f"[{up_color}]{uptime}[/{up_color}]"
        
        t.add_row(progress_str, pass_str, current_action, version_bar, uptime_str)
        return Panel(t, title="[bold #cccccc][ DARKSTAR // INTEROP BENCHMARK ][/bold #cccccc]", border_style="#555555")

    layout["header"].update(get_sys_info())
    layout["dashboard"].update(generate_dashboard())

    versions = ["5"]

    with Live(layout, console=console, refresh_per_second=10) as live:
        for version in versions:
            current_version_int = int(version)
            v5_pk = ""
            v5_sk = ""
            if version == "5":
                current_action = "V5 >> KEYGEN ML-KEM-1024"
                action_start_time = time.perf_counter()
                layout["dashboard"].update(generate_dashboard())
                live.update(layout, refresh=True)
                
                keygen_out, elapsed = run_cli("python", ["-v", "5", "keygen"])
                if keygen_out and not keygen_out.startswith("ERROR"):
                    lines = [l for l in keygen_out.split('\n') if ':' in l]
                    if len(lines) >= 2:
                        v5_pk = lines[0].split(': ')[1].strip()
                        v5_sk = lines[1].split(': ')[1].strip()

            for src_lang in LANGS:
                encrypt_pass = v5_pk if version == "5" else TEST_PASSWORD
                decrypt_pass = v5_sk if version == "5" else TEST_PASSWORD
                
                current_action = f"V{version} >> {src_lang.upper()} ENCRYPT"
                action_start_time = time.perf_counter()
                layout["dashboard"].update(generate_dashboard())
                live.update(layout, refresh=True)
                
                encrypt_output, elapsed = run_cli(src_lang, ["-v", version, "encrypt", TEST_MNEMONIC, encrypt_pass])
                if not encrypt_output or "ERROR" in encrypt_output:
                    errors.append(f"ENCRYPT EXEC FAILED for {src_lang}: {encrypt_output}")
                    continue

                try:
                    start = encrypt_output.find('{')
                    end = encrypt_output.rfind('}') + 1
                    if start == -1 or end == 0:
                        errors.append(f"ENCRYPT PARSE FAILED for {src_lang}: Missing JSON brackets in '{encrypt_output}'")
                        continue
                    res_json = json.loads(encrypt_output[start:end])
                    if not res_json or 'encryptedData' not in res_json:
                        continue
                    
                    encrypted_data = res_json["encryptedData"]
                    if isinstance(encrypted_data, (dict, list)):
                        encrypted_data = json.dumps(encrypted_data)
                        
                    reverse_key = res_json["reverseKey"]
                    if isinstance(reverse_key, (dict, list)):
                        reverse_key = json.dumps(reverse_key)
                except Exception:
                    continue

                for dest_lang in LANGS:
                    total_tests += 1
                    current_action = f"V{version} >> {src_lang.upper()} > {dest_lang.upper()} DECRYPT"
                    action_start_time = time.perf_counter()
                    layout["dashboard"].update(generate_dashboard())
                    live.update(layout, refresh=True)
                    
                    decrypt_output, telapsed = run_cli(dest_lang, ["-v", version, "decrypt", encrypted_data, reverse_key, decrypt_pass])
                    if decrypt_output == TEST_MNEMONIC:
                        passed_tests += 1
                    else:
                        errors.append(f"DECRYPT FAILED: src={src_lang}, dest={dest_lang}, ver={version}\n  Decrypted: '{decrypt_output}'\n  Expected: '{TEST_MNEMONIC}'")
                        
                    layout["dashboard"].update(generate_dashboard())
                    live.update(layout, refresh=True)

    elapsed_total = f"{time.perf_counter() - start_suite:.2f}s"
    console.print()
    for e in errors:
        console.print(f"[bold red]{e}[/bold red]")
    if passed_tests == TOTAL_EXPECTED_TESTS:
        console.print(f"[bold #aaaaaa]>>> DARKSTAR VERIFIED  {passed_tests}/{TOTAL_EXPECTED_TESTS} passed  {elapsed_total} <<<[/bold #aaaaaa]")
        sys.exit(0)
    else:
        console.print(f"[bold #aa3333]>>> BREACH DETECTED  {passed_tests}/{TOTAL_EXPECTED_TESTS} passed  {elapsed_total} <<<[/bold #aa3333]")
        sys.exit(1)

if __name__ == "__main__":
    main()
