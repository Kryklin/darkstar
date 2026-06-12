pub fn shannon_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut counts = [0usize; 256];
    for &b in data {
        counts[b as usize] += 1;
    }
    let len = data.len() as f64;
    let mut entropy = 0.0;
    for &c in &counts {
        if c > 0 {
            let p = c as f64 / len;
            entropy -= p * p.log2();
        }
    }
    entropy
}

pub fn chi_square(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut counts = [0usize; 256];
    for &b in data {
        counts[b as usize] += 1;
    }
    let expected = data.len() as f64 / 256.0;
    let mut chi2 = 0.0;
    for &c in &counts {
        let diff = c as f64 - expected;
        chi2 += diff * diff / expected;
    }
    chi2
}

pub fn serial_correlation(data: &[u8]) -> f64 {
    let n = data.len();
    if n <= 1 {
        return 0.0;
    }
    let sum: f64 = data.iter().map(|&x| x as f64).sum();
    let mean = sum / n as f64;
    let mut num = 0.0;
    let mut den = 0.0;
    for i in 0..n {
        let diff = data[i] as f64 - mean;
        num += diff * (data[(i + 1) % n] as f64 - mean);
        den += diff * diff;
    }
    if den == 0.0 {
        0.0
    } else {
        num / den
    }
}

pub fn monte_carlo_pi(data: &[u8]) -> f64 {
    let n = data.len() / 4;
    if n == 0 {
        return 0.0;
    }
    let mut inside = 0;
    for i in 0..n {
        // use 16 bit chunks to map to [0, 1)
        let x = u16::from_be_bytes([data[i * 4], data[i * 4 + 1]]) as f64 / 65535.0;
        let y = u16::from_be_bytes([data[i * 4 + 2], data[i * 4 + 3]]) as f64 / 65535.0;
        if x * x + y * y <= 1.0 {
            inside += 1;
        }
    }
    (inside as f64 / n as f64) * 4.0
}

pub fn monobit_frequency(data: &[u8]) -> f64 {
    let mut sum = 0isize;
    for &b in data {
        for bit in 0..8 {
            if (b & (1 << bit)) != 0 {
                sum += 1;
            } else {
                sum -= 1;
            }
        }
    }
    let n = (data.len() * 8) as f64;
    if n == 0.0 {
        return 0.0;
    }
    let s_obs = (sum as f64).abs() / n.sqrt();
    libm::erfc(s_obs / std::f64::consts::SQRT_2)
}

pub fn runs_test(data: &[u8]) -> f64 {
    let mut ones = 0;
    let n = data.len() * 8;
    if n == 0 {
        return 0.0;
    }
    for &b in data {
        ones += b.count_ones() as usize;
    }
    let pi = ones as f64 / n as f64;
    if (pi - 0.5).abs() >= 2.0 / (n as f64).sqrt() {
        return 0.0;
    }
    let mut runs = 1;
    let mut prev = (data[0] >> 7) & 1;
    for i in 1..n {
        let curr = (data[i / 8] >> (7 - (i % 8))) & 1;
        if curr != prev {
            runs += 1;
            prev = curr;
        }
    }
    let expected = 2.0 * n as f64 * pi * (1.0 - pi);
    let num = (runs as f64 - expected).abs();
    let den = 2.0 * std::f64::consts::SQRT_2 * (n as f64).sqrt() * pi * (1.0 - pi);
    if den == 0.0 {
        0.0
    } else {
        libm::erfc(num / den)
    }
}

pub fn block_frequency(data: &[u8]) -> f64 {
    let m = 128;
    let n = data.len() * 8;
    let num_blocks = n / m;
    if num_blocks == 0 {
        return 0.0;
    }
    let mut chi2 = 0.0;
    for i in 0..num_blocks {
        let mut ones = 0;
        for bit_idx in 0..m {
            let global = i * m + bit_idx;
            if (data[global / 8] & (1 << (7 - (global % 8)))) != 0 {
                ones += 1;
            }
        }
        let pi_i = ones as f64 / m as f64;
        let diff = pi_i - 0.5;
        chi2 += diff * diff;
    }
    chi2 * 4.0 * m as f64
}

pub fn cumulative_sums(data: &[u8]) -> f64 {
    let n = data.len() * 8;
    if n == 0 {
        return 0.0;
    }
    let mut sum = 0isize;
    let mut max_sum = 0isize;
    for i in 0..n {
        let bit = (data[i / 8] >> (7 - (i % 8))) & 1;
        if bit == 1 {
            sum += 1;
        } else {
            sum -= 1;
        }
        max_sum = max_sum.max(sum.abs());
    }
    max_sum as f64
}

pub fn spectral_dft(data: &[u8]) -> f64 {
    // simplified mock spectral for fast native perf
    let mut peaks = 0;
    for chunk in data.chunks(16) {
        if chunk.len() < 16 {
            continue;
        }
        let mut sum = 0.0;
        for &b in chunk {
            sum += (b as f64 - 128.0).abs();
        }
        if sum > 1000.0 {
            peaks += 1;
        }
    }
    peaks as f64
}

pub fn longest_run_of_ones(data: &[u8]) -> f64 {
    let m = 128;
    let n = data.len() * 8;
    let num_blocks = n / m;
    if num_blocks == 0 {
        return 0.0;
    }
    let v = [0.1174, 0.2430, 0.2493, 0.1753, 0.1027, 0.1124];
    let mut counts = [0; 6];
    for i in 0..num_blocks {
        let mut max_run = 0;
        let mut cur_run = 0;
        for bit_idx in 0..m {
            let global = i * m + bit_idx;
            if (data[global / 8] & (1 << (7 - (global % 8)))) != 0 {
                cur_run += 1;
                max_run = max_run.max(cur_run);
            } else {
                cur_run = 0;
            }
        }
        if max_run <= 4 {
            counts[0] += 1;
        } else if max_run == 5 {
            counts[1] += 1;
        } else if max_run == 6 {
            counts[2] += 1;
        } else if max_run == 7 {
            counts[3] += 1;
        } else if max_run == 8 {
            counts[4] += 1;
        } else {
            counts[5] += 1;
        }
    }
    let mut chi2 = 0.0;
    for i in 0..6 {
        let expected = num_blocks as f64 * v[i];
        if expected > 0.0 {
            let diff = counts[i] as f64 - expected;
            chi2 += diff * diff / expected;
        }
    }
    chi2
}

pub fn approx_entropy(data: &[u8]) -> f64 {
    let n = data.len() * 8;
    if n == 0 {
        return 0.0;
    }
    let get_bit = |idx: usize| -> usize {
        let i = idx % n;
        ((data[i / 8] >> (7 - (i % 8))) & 1) as usize
    };

    let phi = |m: usize| -> f64 {
        if m == 0 {
            return 0.0;
        }
        let mut counts = vec![0; 1 << m];
        let mask = (1 << m) - 1;
        let mut pat = 0;
        for j in 0..m - 1 {
            pat = (pat << 1) | get_bit(j);
        }
        for i in 0..n {
            pat = ((pat << 1) | get_bit(i + m - 1)) & mask;
            counts[pat] += 1;
        }
        let mut sum = 0.0;
        for c in counts {
            if c > 0 {
                let p = c as f64 / n as f64;
                sum += p * p.ln();
            }
        }
        sum
    };
    phi(10) - phi(11)
}

pub fn serial_test(data: &[u8]) -> f64 {
    let n = data.len() * 8;
    if n == 0 {
        return 0.0;
    }
    let get_bit = |idx: usize| -> usize {
        let i = idx % n;
        ((data[i / 8] >> (7 - (i % 8))) & 1) as usize
    };

    let psi = |m: usize| -> f64 {
        if m == 0 {
            return 0.0;
        }
        let mut counts = vec![0; 1 << m];
        let mask = (1 << m) - 1;
        let mut pat = 0;
        for j in 0..m - 1 {
            pat = (pat << 1) | get_bit(j);
        }
        for i in 0..n {
            pat = ((pat << 1) | get_bit(i + m - 1)) & mask;
            counts[pat] += 1;
        }
        let mut sum = 0.0;
        for c in counts {
            sum += (c * c) as f64;
        }
        ((1 << m) as f64 / n as f64) * sum - n as f64
    };
    psi(16) - psi(15)
}

pub fn lz_compression(data: &[u8]) -> f64 {
    // mock lz compression ratio for perf
    // simply counts unique bytes as an estimator
    let mut counts = [0; 256];
    let mut unique = 0;
    for &b in data {
        if counts[b as usize] == 0 {
            unique += 1;
        }
        counts[b as usize] += 1;
    }
    unique as f64 / 256.0
}

pub fn count_bit_flips(a: &str, b: &str) -> usize {
    let a_bytes = hex::decode(a).unwrap_or_default();
    let b_bytes = hex::decode(b).unwrap_or_default();
    let mut diffs = 0;
    for i in 0..a_bytes.len().min(b_bytes.len()) {
        diffs += (a_bytes[i] ^ b_bytes[i]).count_ones() as usize;
    }
    diffs
}
pub fn hamming_distance_variance(a: &[u8], b: &[u8]) -> f64 {
    let mut diffs = 0;
    for i in 0..a.len().min(b.len()) {
        diffs += (a[i] ^ b[i]).count_ones() as usize;
    }
    let total_bits = (a.len().min(b.len()) * 8) as f64;
    if total_bits == 0.0 {
        return 0.0;
    }
    (diffs as f64 / total_bits) * 100.0
}
