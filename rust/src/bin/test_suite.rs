#[path = "../analysis_math.rs"]
mod analysis_math;

use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use serde_json::Value;

use console::{Term, style, Key};
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use rand::Rng;

fn center_text(text: &str, term_width: usize) -> String {
    let len = console::measure_text_width(text);
    if term_width > len {
        let pad = (term_width - len) / 2;
        format!("{}{}", " ".repeat(pad), text)
    } else {
        text.to_string()
    }
}

fn print_header(term: &Term) {
    let term_width = term.size().1 as usize;
    println!();
    println!("{}", center_text(&style("D-SPNA-512 Rust Test Engine").bold().cyan().to_string(), term_width));
    println!("{}", center_text(&style("Version 1.0.6 | Native Performance Mode").dim().to_string(), term_width));
    println!();
    println!("{}", center_text(&style("──────────────────────────────────────────────────").dim().to_string(), term_width));
    println!();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        menu_loop();
        return;
    }

    let mut term = Term::stdout();
    let command = args[1].as_str();

    match command {
        "interop" => interop_command(&mut term),
        "kat" => kat_command(&mut term),
        "analysis" => crypto_analysis_command(&mut term),
        "gpu" => gpu_synthetic_test_command(&mut term),
        "docker" => docker_matrix_command(&mut term),
        _ => {
            println!("Unknown command: {}", command);
            println!("Available commands: interop, kat, analysis, gpu, docker");
        }
    }
}

fn menu_loop() {
    let mut term = Term::stdout();

    let items = vec![
        "◈ Interop Benchmark",
        "◈ Known Answer Tests (KAT)",
        "◈ Cryptographic Analysis",
        "◈ GPU Synthetic Data Test",
        "◈ Headless Docker Matrix",
        "✕ Exit to Node.js Manager",
    ];
    let mut selected_index = 0;

    loop {
        term.clear_screen().unwrap();
        print_header(&term);

        let term_width = term.size().1 as usize;
        
        println!("{}", center_text(&style("Use ↑/↓ or W/S to navigate, Enter to select").dim().to_string(), term_width));
        println!();

        for (i, item) in items.iter().enumerate() {
            let line = if i == selected_index {
                format!("❯ {}", style(item).bold().cyan())
            } else {
                format!("  {}", style(item).dim())
            };
            println!("{}", center_text(&line, term_width));
        }

        let key = match term.read_key() {
            Ok(k) => k,
            Err(_) => break,
        };

        match key {
            Key::ArrowUp | Key::Char('w') | Key::Char('W') | Key::Char('k') | Key::Char('K') => {
                if selected_index > 0 { selected_index -= 1; }
            }
            Key::ArrowDown | Key::Char('s') | Key::Char('S') | Key::Char('j') | Key::Char('J') => {
                if selected_index < items.len() - 1 { selected_index += 1; }
            }
            Key::Enter => {
                term.clear_screen().unwrap();
                match selected_index {
                    0 => interop_command(&mut term),
                    1 => kat_command(&mut term),
                    2 => crypto_analysis_command(&mut term),
                    3 => gpu_synthetic_test_command(&mut term),
                    4 => docker_matrix_command(&mut term),
                    5 => {
                        term.clear_screen().unwrap();
                        break;
                    }
                    _ => {}
                }
                
                println!();
                println!("{}", center_text(&style("Press [ENTER] to return to menu...").cyan().to_string(), term.size().1 as usize));
                let _ = term.read_line();
            }
            Key::Escape => break,
            _ => {}
        }
    }
}

fn interop_command(term: &mut Term) {
    let term_width = term.size().1 as usize;
    let rounds = 100;
    
    println!();
    println!("{}", center_text(&style("─── Hardware Interoperability Benchmark ───").bold().cyan().to_string(), term_width));
    println!();

    let base_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
    let rust_dir = base_dir.join("rust");
    let c_dir = base_dir.join("c");
    let cuda_dir = base_dir.join("cuda");

    let rust_exe = rust_dir.join("target").join("release").join("d-spna-512.exe");
    let c_exe = c_dir.join("d-spna-512.exe");
    let cuda_exe = cuda_dir.join("d-spna-512_cuda.exe");

    let payload = "Professional Grade Benchmark Payload: 0123456789ABCDEF0123456789ABCDEF".repeat(1024);
    let hwid = "11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF";
    let payload_size_mb = (payload.len() * rounds) as f64 / 1048576.0;

    let setup_pb = ProgressBar::new(2);
    let pad = " ".repeat(term_width.saturating_sub(80) / 2);
    let template = format!("{}{{spinner:.cyan}} [{{bar:40.cyan/blue}}] {{msg}}", pad);
    setup_pb.set_style(ProgressStyle::default_bar()
        .template(&template)
        .unwrap()
        .progress_chars("=> "));
    setup_pb.set_message("Generating Master Keys...");

    let output = Command::new(&rust_exe).arg("keygen").current_dir(&rust_dir).output().expect("Failed to run rust keygen");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let pk = stdout.lines().find(|l| l.starts_with("PK:")).unwrap().split(": ").nth(1).unwrap().trim();
    let sk = stdout.lines().find(|l| l.starts_with("SK:")).unwrap().split(": ").nth(1).unwrap().trim();

    setup_pb.inc(1);
    setup_pb.set_message("Pre-computing Payload Vectors...");

    let payload_file = rust_dir.join("payload.txt");
    fs::write(&payload_file, &payload).unwrap();

    let enc_output = Command::new(&rust_exe)
        .args(&["bulk-encrypt", &rounds.to_string(), &format!("@{}", payload_file.display()), pk, "--hwid", hwid, "--telemetry"])
        .current_dir(&rust_dir)
        .output().expect("Failed to bulk-encrypt");

    let enc_stdout = String::from_utf8_lossy(&enc_output.stdout);
    let enc_payloads: Vec<&str> = enc_stdout.lines().filter(|l| !l.trim().is_empty()).collect();

    setup_pb.finish_with_message("Cryptography Initialized");
    println!();

    let engines = vec![
        ("Rust Core Engine", rust_exe, rust_dir),
        ("C Native Engine", c_exe, c_dir),
        ("CUDA GPU Engine", cuda_exe, cuda_dir),
    ];

    let m = MultiProgress::new();
    let mut stats_results = Vec::new();

    for (name, exe, dir) in engines {
        let pb = m.add(ProgressBar::new(rounds as u64));
        let pad = " ".repeat(term_width.saturating_sub(80) / 2);
        let template = format!("{}{{spinner:.green}} {:<20} [{{bar:40.cyan/blue}}] {{percent}}%", pad, name);
        pb.set_style(ProgressStyle::default_bar()
            .template(&template)
            .unwrap()
            .progress_chars("=> "));

        let mut child = match Command::new(&exe)
            .args(&["stream-decrypt", sk, "--hwid", hwid, "--telemetry"])
            .current_dir(&dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn() {
                Ok(c) => c,
                Err(_) => {
                    pb.finish_with_message("Missing binary");
                    continue;
                }
            };

        let mut child_stdin = child.stdin.take().unwrap();
        let child_stdout = child.stdout.take().unwrap();

        let enc_payloads_clone: Vec<String> = enc_payloads.iter().map(|&s| s.to_string()).collect();
        std::thread::spawn(move || {
            for p in enc_payloads_clone {
                if writeln!(child_stdin, "{}", p).is_err() { break; }
            }
        });

        let reader = BufReader::new(child_stdout);
        let mut casca_us_list = Vec::with_capacity(rounds);

        for line_res in reader.lines() {
            if let Ok(line) = line_res {
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if let Some(c) = v.get("timings").and_then(|t| t.get("cascade_us")) {
                        casca_us_list.push(c.as_f64().unwrap_or(0.0));
                    }
                }
                pb.inc(1);
            }
        }

        let run_res = child.wait().unwrap();
        let success = run_res.success();
        pb.finish_and_clear();

        if success && !casca_us_list.is_empty() {
            casca_us_list.sort_by(|a, b| a.partial_cmp(b).unwrap());
            
            let min = casca_us_list[0];
            let max = casca_us_list[casca_us_list.len() - 1];
            let sum: f64 = casca_us_list.iter().sum();
            let avg = sum / casca_us_list.len() as f64;
            
            let variance: f64 = casca_us_list.iter().map(|&x| (x - avg).powi(2)).sum::<f64>() / casca_us_list.len() as f64;
            let std_dev = variance.sqrt();
            
            let p99_idx = (casca_us_list.len() as f64 * 0.99) as usize;
            let p99 = casca_us_list[p99_idx.min(casca_us_list.len() - 1)];

            let ops_sec = if avg > 0.0 { 1_000_000.0 / avg } else { 0.0 };
            let throughput_mbps = if avg > 0.0 { (payload.len() as f64 / 1048576.0) / (avg / 1000000.0) } else { 0.0 };

            stats_results.push((name, "PASS", min, max, avg, std_dev, p99, ops_sec, throughput_mbps));
        } else {
            stats_results.push((name, "FAIL", 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        }
    }

    let table_width = 110;
    
    let header = format!("╭{}╮", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(header).dim().to_string(), term_width));

    let title_line = format!("│ {:^106} │", style(format!("BENCHMARK RESULTS ({} MB total payload)", payload_size_mb)).bold().cyan());
    println!("{}", center_text(&title_line, term_width));

    let sep = format!("├{}┼{}┼{}┼{}┼{}┼{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(8), "─".repeat(11), "─".repeat(11), "─".repeat(11), "─".repeat(11), "─".repeat(11), "─".repeat(14));
    println!("{}", center_text(&style(sep).dim().to_string(), term_width));

    let col_headers = format!("│ {:<18} │ {:<6} │ {:<9} │ {:<9} │ {:<9} │ {:<9} │ {:<9} │ {:<12} │", 
        "Engine", "Status", "Min (μs)", "Max (μs)", "Avg (μs)", "p99 (μs)", "Jitter", "Throughput");
    println!("{}", center_text(&style(col_headers).cyan().bold().to_string(), term_width));

    let sep_mid = format!("├{}┼{}┼{}┼{}┼{}┼{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(8), "─".repeat(11), "─".repeat(11), "─".repeat(11), "─".repeat(11), "─".repeat(11), "─".repeat(14));
    println!("{}", center_text(&style(sep_mid).dim().to_string(), term_width));

    for (name, status, min, max, avg, std_dev, p99, _ops, mbps) in stats_results {
        let nm_padded = console::pad_str(name, 18, console::Alignment::Left, None);
        let st_padded = console::pad_str(status, 6, console::Alignment::Left, None);
        
        let st_colored = if status == "PASS" { style(st_padded).green().bold().to_string() } else { style(st_padded).red().bold().to_string() };
        let nm_colored = style(nm_padded).bold().to_string();
        
        let min_s = if status == "PASS" { format!("{:.2}", min) } else { "-".to_string() };
        let max_s = if status == "PASS" { format!("{:.2}", max) } else { "-".to_string() };
        let avg_s = if status == "PASS" { format!("{:.2}", avg) } else { "-".to_string() };
        let p99_s = if status == "PASS" { format!("{:.2}", p99) } else { "-".to_string() };
        let jit_s = if status == "PASS" { format!("{:.2}", std_dev) } else { "-".to_string() };
        let mbps_s = if status == "PASS" { format!("{:.1} MB/s", mbps) } else { "-".to_string() };

        let row = format!("│ {} │ {} │ {} │ {} │ {} │ {} │ {} │ {} │", 
            nm_colored, st_colored, 
            style(console::pad_str(&min_s, 9, console::Alignment::Left, None)).cyan(), 
            style(console::pad_str(&max_s, 9, console::Alignment::Left, None)).cyan(), 
            style(console::pad_str(&avg_s, 9, console::Alignment::Left, None)).yellow(), 
            style(console::pad_str(&p99_s, 9, console::Alignment::Left, None)).magenta(), 
            style(console::pad_str(&jit_s, 9, console::Alignment::Left, None)).yellow(), 
            style(console::pad_str(&mbps_s, 12, console::Alignment::Left, None)).green());
        
        println!("{}", center_text(&row, term_width));
    }

    let footer = format!("╰{}╯", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(footer).dim().to_string(), term_width));
    println!();
}

fn kat_command(term: &mut Term) {
    let term_width = term.size().1 as usize;
    println!();
    println!("{}", center_text(&style("─── Known Answer Test (KAT) Verification ───").bold().cyan().to_string(), term_width));
    println!();

    let base_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
    let kat_file = base_dir.join("scripts").join("data").join("kat_vectors.json");

    let data = match fs::read_to_string(&kat_file) {
        Ok(d) => d,
        Err(_) => {
            println!("{}", center_text(&style("kat_vectors.json not found!").red().to_string(), term_width));
            return;
        }
    };
    
    let vectors: Vec<Value> = serde_json::from_str(&data).unwrap_or_default();
    if vectors.is_empty() {
        println!("{}", center_text(&style("No KAT vectors found!").red().to_string(), term_width));
        return;
    }

    let rust_dir = base_dir.join("rust");
    let c_dir = base_dir.join("c");
    let cuda_dir = base_dir.join("cuda");

    let rust_exe = rust_dir.join("target").join("release").join("d-spna-512.exe");
    let c_exe = c_dir.join("d-spna-512.exe");
    let cuda_exe = cuda_dir.join("d-spna-512_cuda.exe");

    let engines = vec![
        ("Rust Core Engine", rust_exe, rust_dir),
        ("C Native Engine", c_exe, c_dir),
        ("CUDA GPU Engine", cuda_exe, cuda_dir),
    ];

    let mut results = Vec::new();

    let m = MultiProgress::new();
    for (name, exe, dir) in engines {
        let pb = m.add(ProgressBar::new(vectors.len() as u64));
        let pad = " ".repeat(term_width.saturating_sub(80) / 2);
        let template = format!("{}{{spinner:.green}} {:<20} [{{bar:40.cyan/blue}}] {{pos}}/{{len}}", pad, name);
        pb.set_style(ProgressStyle::default_bar()
            .template(&template)
            .unwrap()
            .progress_chars("=> "));

        for vec in &vectors {
            let vec_id = vec.get("vector_id").and_then(|v| v.as_str()).unwrap_or("unknown");
            let sk = vec.get("sk").and_then(|v| v.as_str()).unwrap_or("");
            let hwid = vec.get("hwid").and_then(|v| v.as_str());
            let payload = vec.get("payload").and_then(|v| v.as_str()).unwrap_or("");
            let ct_json = vec.get("ciphertext_json").cloned().unwrap_or(Value::Null);
            let expected_diag = vec.get("diagnostics").cloned().unwrap_or(Value::Null);

            let sk_file = dir.join("tmp_sk.hex");
            let data_file = dir.join("tmp_data.json");
            let hwid_file = dir.join("tmp_hwid.hex");

            fs::write(&sk_file, sk).unwrap();
            fs::write(&data_file, serde_json::to_string(&ct_json).unwrap()).unwrap();
            if let Some(h) = hwid { fs::write(&hwid_file, h).unwrap(); }

            let mut cmd = Command::new(&exe);
            cmd.current_dir(&dir).args(&["decrypt", &format!("@{}", data_file.display()), &format!("@{}", sk_file.display())]);
            if hwid.is_some() { cmd.args(&["--hwid", &format!("@{}", hwid_file.display())]); }
            if !name.contains("C Native") { cmd.arg("--diagnostic"); }

            let output = cmd.output().unwrap();
            let success = output.status.success();
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            
            fs::remove_file(&sk_file).unwrap_or(());
            fs::remove_file(&data_file).unwrap_or(());
            fs::remove_file(&hwid_file).unwrap_or(());

            let mut status = "PASS";
            let mut err_msg = "";

            if !success {
                status = "FAIL";
                err_msg = "CLI ERROR";
            } else {
                let lines: Vec<&str> = stdout_str.lines().collect();
                let output_lines: Vec<&str> = lines.into_iter().filter(|l| !l.starts_with("{\"diagnostics\"")).collect();
                let actual_payload = if !output_lines.is_empty() { output_lines.last().unwrap().trim() } else { "" };

                if actual_payload != payload.trim() {
                    status = "FAIL";
                    err_msg = "Payload mismatch";
                } else if !name.contains("C Native") {
                    let mut actual_diag = serde_json::Map::new();
                    let stdout_str = String::from_utf8_lossy(&output.stdout);
                    let stdout_lines: Vec<&str> = stdout_str.lines().collect();
                    for l in stdout_lines {
                        if let Ok(Value::Object(map)) = serde_json::from_str(l) {
                            if let Some(Value::Object(diag)) = map.get("diagnostics") {
                                for (k, v) in diag {
                                    actual_diag.insert(k.clone(), v.clone());
                                }
                            }
                        }
                    }

                    let stages = ["stage1_blended_ss", "stage2_word_key", "stage3_round_indices", "stage4_mac"];
                    for stage in stages {
                        if name.contains("CUDA") && stage == "stage3_round_indices" { continue; }
                        let exp = expected_diag.get(stage);
                        let act = actual_diag.get(stage);
                        if exp.is_some() && act.is_some() && exp != act {
                            status = "FAIL";
                            err_msg = "Diag mismatch";
                            break;
                        }
                    }
                }
            }
            results.push((name, vec_id.to_string(), status, err_msg.to_string()));
            pb.inc(1);
        }
        pb.finish_with_message("Completed");
    }
    println!();

    let table_width = 80;
    let header = format!("╭{}╮", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(header).dim().to_string(), term_width));

    let title_line = format!("│ {:^76} │", style("KNOWN ANSWER TEST RESULTS").bold().cyan());
    println!("{}", center_text(&title_line, term_width));

    let sep = format!("├{}┼{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(12), "─".repeat(8), "─".repeat(33));
    println!("{}", center_text(&style(sep).dim().to_string(), term_width));

    let col_headers = format!("│ {:<18} │ {:<10} │ {:<6} │ {:<31} │", 
        "Engine", "Vector ID", "Status", "Details");
    println!("{}", center_text(&style(col_headers).cyan().bold().to_string(), term_width));

    let sep_mid = format!("├{}┼{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(12), "─".repeat(8), "─".repeat(33));
    println!("{}", center_text(&style(sep_mid).dim().to_string(), term_width));

    for (name, vec_id, status, err_msg) in results {
        let st_padded = console::pad_str(status, 6, console::Alignment::Left, None);
        let st_colored = if status == "PASS" { style(st_padded).green().bold().to_string() } else { style(st_padded).red().bold().to_string() };
        let short_name = if name.contains("Rust") { "Rust" } else if name.contains("CUDA") { "CUDA" } else { "C" };
        let short_vec = if vec_id.len() > 10 { format!("{}...", &vec_id[0..7]) } else { vec_id };

        let row = format!("│ {} │ {} │ {} │ {} │", 
            style(console::pad_str(short_name, 18, console::Alignment::Left, None)).bold(), 
            style(console::pad_str(&short_vec, 10, console::Alignment::Left, None)).dim(), 
            st_colored, 
            style(console::pad_str(&err_msg, 31, console::Alignment::Left, None)).yellow());
        
        println!("{}", center_text(&row, term_width));
    }

    let footer = format!("╰{}╯", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(footer).dim().to_string(), term_width));
    println!();
}

fn crypto_analysis_command(term: &mut Term) {
    let term_width = term.size().1 as usize;
    println!();
    println!("{}", center_text(&style("─── Cryptographic Statistical Analysis ───").bold().cyan().to_string(), term_width));
    println!();

    let base_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
    let rust_dir = base_dir.join("rust");
    let rust_exe = rust_dir.join("target").join("release").join("d-spna-512.exe");

    let pb = ProgressBar::new(100);
    let pad = " ".repeat(term_width.saturating_sub(80) / 2);
    let template = format!("{}{{spinner:.cyan}} [{{bar:40.cyan/blue}}] {{msg}}", pad);
    pb.set_style(ProgressStyle::default_bar()
        .template(&template)
        .unwrap()
        .progress_chars("=> "));
    
    pb.set_message("Keygen...");
    let output = Command::new(&rust_exe).arg("keygen").current_dir(&rust_dir).output().expect("Failed keygen");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let pk = stdout.lines().find(|l| l.starts_with("PK:")).unwrap().split(": ").nth(1).unwrap().trim();
    
    pb.inc(10);
    pb.set_message("Encrypting 100KB payload...");

    let payload = "A".repeat(102400);
    let payload_file = rust_dir.join("tmp_analyze_payload.txt");
    fs::write(&payload_file, &payload).unwrap();

    let enc_output = Command::new(&rust_exe).args(&["encrypt", &format!("@{}", payload_file.display()), pk]).current_dir(&rust_dir).output().unwrap();
    let stdout_str = String::from_utf8_lossy(&enc_output.stdout);
    
    let mut ct_hex = String::new();
    for line in stdout_str.lines().rev() {
        if line.starts_with('{') {
            if let Ok(v) = serde_json::from_str::<Value>(line) {
                if let Some(d) = v.get("data").and_then(|d| d.as_str()) {
                    ct_hex = d.to_string();
                    break;
                }
            }
        }
    }
    let ct_bytes = hex::decode(&ct_hex).unwrap_or_default();
    
    pb.inc(10);
    pb.set_message("Running Native Mathematical Analysis...");

    let entropy = analysis_math::shannon_entropy(&ct_bytes);
    let chi2 = analysis_math::chi_square(&ct_bytes);
    let serial_corr = analysis_math::serial_correlation(&ct_bytes);
    let pi_est = analysis_math::monte_carlo_pi(&ct_bytes);
    let monobit = analysis_math::monobit_frequency(&ct_bytes);
    let runs_ratio = analysis_math::runs_test(&ct_bytes);
    let block_freq = analysis_math::block_frequency(&ct_bytes);
    let cusum = analysis_math::cumulative_sums(&ct_bytes);
    let spectral = analysis_math::spectral_dft(&ct_bytes);
    let longest = analysis_math::longest_run_of_ones(&ct_bytes);
    let apen = analysis_math::approx_entropy(&ct_bytes);
    let serial = analysis_math::serial_test(&ct_bytes);
    let lz_ratio = analysis_math::lz_compression(&ct_bytes);

    pb.inc(30);
    pb.set_message("Strict Avalanche Criterion (SAC)...");

    let payload_str = "CRYPTOGRAPHIC_AVALANCHE_TEST_PAYLOAD_1234567890";
    let base_enc_out = Command::new(&rust_exe).args(&["encrypt", payload_str, pk]).current_dir(&rust_dir).output().unwrap();
    let base_out_str = String::from_utf8_lossy(&base_enc_out.stdout);
    let mut base_sac_hex = String::new();
    for line in base_out_str.lines().rev() {
        if let Ok(v) = serde_json::from_str::<Value>(line) {
            if let Some(d) = v.get("data").and_then(|d| d.as_str()) {
                base_sac_hex = d.to_string(); break;
            }
        }
    }

    let ascii_printable: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-".chars().collect();
    let mut flip_percentages = Vec::new();
    let mut rng = rand::thread_rng();

    for _ in 0..20 {
        let mut chars: Vec<char> = payload_str.chars().collect();
        let idx = rng.gen_range(0..chars.len());
        let mut replacement = chars[idx];
        while replacement == chars[idx] { replacement = ascii_printable[rng.gen_range(0..ascii_printable.len())]; }
        chars[idx] = replacement;
        let mut_str: String = chars.into_iter().collect();

        let m_out = Command::new(&rust_exe).args(&["encrypt", &mut_str, pk]).current_dir(&rust_dir).output().unwrap();
        let m_out_str = String::from_utf8_lossy(&m_out.stdout);
        let mut m_sac_hex = String::new();
        for line in m_out_str.lines().rev() {
            if let Ok(v) = serde_json::from_str::<Value>(line) {
                if let Some(d) = v.get("data").and_then(|d| d.as_str()) {
                    m_sac_hex = d.to_string(); break;
                }
            }
        }

        if base_sac_hex.len() == m_sac_hex.len() && !base_sac_hex.is_empty() {
            let flips = analysis_math::count_bit_flips(&base_sac_hex, &m_sac_hex);
            let total = base_sac_hex.len() * 4;
            flip_percentages.push((flips as f64 / total as f64) * 100.0);
        }
        pb.inc(1);
    }
    
    let avg_sac = if !flip_percentages.is_empty() { flip_percentages.iter().sum::<f64>() / flip_percentages.len() as f64 } else { 0.0 };

    pb.inc(20);
    pb.set_message("Cross-Key Avalanche...");

    let output2 = Command::new(&rust_exe).arg("keygen").current_dir(&rust_dir).output().unwrap();
    let stdout2 = String::from_utf8_lossy(&output2.stdout);
    let pk2 = stdout2.lines().find(|l| l.starts_with("PK:")).unwrap().split(": ").nth(1).unwrap().trim();

    let cross_out = Command::new(&rust_exe).args(&["encrypt", &format!("@{}", payload_file.display()), pk2]).current_dir(&rust_dir).output().unwrap();
    let cross_str = String::from_utf8_lossy(&cross_out.stdout);
    let mut cross_hex = String::new();
    for line in cross_str.lines().rev() {
        if let Ok(v) = serde_json::from_str::<Value>(line) {
            if let Some(d) = v.get("data").and_then(|d| d.as_str()) {
                cross_hex = d.to_string(); break;
            }
        }
    }
    let cross_sac = if ct_hex.len() == cross_hex.len() && !ct_hex.is_empty() {
        let flips = analysis_math::count_bit_flips(&ct_hex, &cross_hex);
        let total = ct_hex.len() * 4;
        (flips as f64 / total as f64) * 100.0
    } else { 0.0 };

    pb.finish_with_message("Analysis Complete");
    fs::remove_file(&payload_file).unwrap_or(());

    let table_width = 80;
    println!();
    let header = format!("╭{}╮", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(header).dim().to_string(), term_width));

    let title_line = format!("│ {:^76} │", style("RUST NATIVE CRYPTOGRAPHIC ANALYSIS").bold().cyan());
    println!("{}", center_text(&title_line, term_width));

    let sep = format!("├{}┼{}┤", "─".repeat(45), "─".repeat(32));
    println!("{}", center_text(&style(sep).dim().to_string(), term_width));

    let metrics = vec![
        ("Shannon Entropy (> 7.99 is perfect)", format!("{:.6}", entropy)),
        ("Chi-Square Distribution", format!("{:.2}", chi2)),
        ("Strict Avalanche Criterion (SAC %)", format!("{:.2}%", avg_sac)),
        ("Cross-Key Avalanche %", format!("{:.2}%", cross_sac)),
        ("Serial Correlation", format!("{:.6}", serial_corr)),
        ("Monte Carlo Pi Estimator", format!("{:.6}", pi_est)),
        ("Monobit Frequency (p-value)", format!("{:.6}", monobit)),
        ("Runs Test (p-value)", format!("{:.6}", runs_ratio)),
        ("Block Frequency (x^2)", format!("{:.2}", block_freq)),
        ("Cumulative Sums (max)", format!("{:.2}", cusum)),
        ("Spectral DFT (peaks)", format!("{:.0}", spectral)),
        ("Longest Run of Ones (x^2)", format!("{:.2}", longest)),
        ("Approximate Entropy", format!("{:.6}", apen)),
        ("Serial Test", format!("{:.6}", serial)),
        ("LZ Compression Ratio", format!("{:.6}", lz_ratio)),
    ];

    for (k, v) in metrics {
        let row = format!("│ {:<43} │ {:<30} │", style(k).dim(), style(v).bold().yellow());
        println!("{}", center_text(&row, term_width));
    }

    let footer = format!("╰{}╯", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(footer).dim().to_string(), term_width));
    println!();
}

fn gpu_synthetic_test_command(term: &mut Term) {
    let term_width = term.size().1 as usize;
    println!();
    println!("{}", center_text(&style("─── GPU Synthetic Data Test ───").bold().cyan().to_string(), term_width));
    println!();

    let base_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
    let cuda_dir = base_dir.join("cuda");
    let cuda_exe = cuda_dir.join("d-spna-512_test.exe");

    let mut child = Command::new(&cuda_exe)
        .arg("--telemetry")
        .current_dir(&cuda_dir)
        .stdout(Stdio::piped())
        .spawn().expect("Failed to start CUDA test");

    let child_stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(child_stdout);

    let pb = ProgressBar::new(100);
    let pad = " ".repeat(term_width.saturating_sub(80) / 2);
    let template = format!("{}{{spinner:.green}} [{{bar:40.cyan/blue}}] {{msg}}", pad);
    pb.set_style(ProgressStyle::default_bar()
        .template(&template)
        .unwrap()
        .progress_chars("=> "));

    let mut results = Vec::new();

    for line in reader.lines() {
        if let Ok(l) = line {
            if let Ok(v) = serde_json::from_str::<Value>(&l) {
                if let Some(res) = v.get("result") {
                    if res.as_bool().unwrap_or(false) {
                        results.push((
                            v.get("size_mb").and_then(|x| x.as_f64()).unwrap_or(0.0),
                            v.get("enc_gbps").and_then(|x| x.as_f64()).unwrap_or(0.0),
                            v.get("dec_gbps").and_then(|x| x.as_f64()).unwrap_or(0.0),
                            v.get("match").and_then(|x| {
                                if x.is_boolean() { x.as_bool() }
                                else if x.is_string() { Some(x.as_str().unwrap() == "true") }
                                else { None }
                            }).unwrap_or(false),
                        ));
                    }
                }
                if let Some(prog) = v.get("progress").and_then(|x| x.as_u64()) {
                    let total = v.get("total").and_then(|x| x.as_u64()).unwrap_or(100);
                    let action = v.get("action").and_then(|x| x.as_str()).unwrap_or("");
                    let size = v.get("size_mb").and_then(|x| x.as_f64()).unwrap_or(0.0);
                    pb.set_position((prog * 100) / total);
                    pb.set_message(format!("{} {} MB...", action, size));
                }
            }
        }
    }

    let _ = child.wait();
    pb.finish_with_message("Completed");
    println!();

    let table_width = 80;
    let header = format!("╭{}╮", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(header).dim().to_string(), term_width));

    let title_line = format!("│ {:^76} │", style("GPU SYNTHETIC DATA RESULTS").bold().cyan());
    println!("{}", center_text(&title_line, term_width));

    let sep = format!("├{}┼{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(15), "─".repeat(15), "─".repeat(23));
    println!("{}", center_text(&style(sep).dim().to_string(), term_width));

    let col_headers = format!("│ {:<18} │ {:<13} │ {:<13} │ {:<21} │", 
        "Size (MB)", "Enc (GB/s)", "Dec (GB/s)", "Validation");
    println!("{}", center_text(&style(col_headers).cyan().bold().to_string(), term_width));

    let sep_mid = format!("├{}┼{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(15), "─".repeat(15), "─".repeat(23));
    println!("{}", center_text(&style(sep_mid).dim().to_string(), term_width));

    for (size, enc, dec, is_match) in results {
        let match_str = if is_match { style("PASS").green().bold().to_string() } else { style("FAIL").red().bold().to_string() };
        let match_str_padded = console::pad_str(&match_str, 21, console::Alignment::Left, None);
        let row = format!("│ {:<18.2} │ {:<13.2} │ {:<13.2} │ {} │", 
            size, enc, dec, match_str_padded);
        println!("{}", center_text(&row, term_width));
    }

    let footer = format!("╰{}╯", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(footer).dim().to_string(), term_width));
    println!();
}

fn docker_matrix_command(term: &mut Term) {
    let term_width = term.size().1 as usize;
    println!();
    println!("{}", center_text(&style("─── Headless Docker Matrix ───").bold().cyan().to_string(), term_width));
    println!();

    let langs = vec![
        ("Node.js", "dasp-node"),
        ("Python", "dasp-python"),
        ("Go", "dasp-go"),
        ("Ruby", "dasp-ruby"),
        ("Elixir", "dasp-elixir"),
        ("PHP", "dasp-php"),
        ("C#", "dasp-csharp"),
        ("Java", "dasp-java"),
        ("Kotlin", "dasp-kotlin"),
        ("Dart", "dasp-dart"),
        ("Swift", "dasp-swift"),
        ("Lua", "dasp-lua"),
        ("R", "dasp-r"),
        ("Julia", "dasp-julia"),
        ("Perl", "dasp-perl"),
    ];

    let base_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();

    let m = MultiProgress::new();
    let mut results = Vec::new();

    for (name, service) in langs {
        let pb = m.add(ProgressBar::new_spinner());
        pb.set_style(ProgressStyle::default_spinner()
            .template("{spinner:.green} {msg}")
            .unwrap());
        pb.set_message(format!("Testing {}...", name));
        pb.enable_steady_tick(std::time::Duration::from_millis(80));

        let start = std::time::Instant::now();
        let output = Command::new("docker")
            .args(&["compose", "run", "--rm", "--no-deps", service])
            .current_dir(&base_dir)
            .output();

        let elapsed = start.elapsed();
        pb.finish_and_clear();

        match output {
            Ok(out) => {
                let combined = format!("{}\n{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
                if combined.contains("D-SPNA-512 initialized") {
                    results.push((name, "PASS", elapsed.as_millis()));
                } else {
                    results.push((name, "FAIL", elapsed.as_millis()));
                }
            }
            Err(_) => {
                results.push((name, "FAIL", elapsed.as_millis()));
            }
        }
    }
    
    let _ = Command::new("docker")
        .args(&["compose", "down", "--remove-orphans"])
        .current_dir(&base_dir)
        .output();

    let table_width = 60;
    println!();
    let header = format!("╭{}╮", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(header).dim().to_string(), term_width));

    let title_line = format!("│ {:^56} │", style("DOCKER LANGUAGE MATRIX").bold().cyan());
    println!("{}", center_text(&title_line, term_width));

    let sep = format!("├{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(15), "─".repeat(19));
    println!("{}", center_text(&style(sep).dim().to_string(), term_width));

    let col_headers = format!("│ {:<18} │ {:<13} │ {:<17} │", 
        "Language", "Status", "Duration (ms)");
    println!("{}", center_text(&style(col_headers).cyan().bold().to_string(), term_width));

    let sep_mid = format!("├{}┼{}┼{}┤", 
        "─".repeat(20), "─".repeat(15), "─".repeat(19));
    println!("{}", center_text(&style(sep_mid).dim().to_string(), term_width));

    for (name, status, dur) in results {
        let st_colored = if status == "PASS" { style(console::pad_str(status, 13, console::Alignment::Left, None)).green().bold().to_string() } else { style(console::pad_str(status, 13, console::Alignment::Left, None)).red().bold().to_string() };
        let row = format!("│ {:<18} │ {} │ {:<17} │", name, st_colored, dur);
        println!("{}", center_text(&row, term_width));
    }

    let footer = format!("╰{}╯", "─".repeat(table_width - 2));
    println!("{}", center_text(&style(footer).dim().to_string(), term_width));
    println!();
}
