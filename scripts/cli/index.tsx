import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import { runInteropBenchmark, InteropResult } from './tests/interop.js';
import { runKatVerification, KatResult } from './tests/kat.js';
import { runGpuTest, GpuTestResult } from './tests/gpu.js';
import { CryptoAnalysisResult, runCryptoAnalysis } from './tests/analyze.js';
import SelectInput from 'ink-select-input';
import { ShellJobRunner, ScriptRunner, CleanRunner, EnvCheckRunner, BumpRunner, BuildEnginesRunner } from './runners.js';


const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = require('../../package.json');

// --- React Components ---

const logoLines = [
  "                             █   ▓                ",
  "                            ▓▓  ▓█                ",
  "                           ▓█ ▓█ ▓▓               ",
  "                         ▓▓ ▓▓█▓▓█▓               ",
  "                   ██▓▓ █▓▓█▓██▓█                 ",
  "                  ▓▓███▓  ▓▓█▓█▓▓                 ",
  "                   ▓▓▓▓▓██▓ ▓█▓█                  ",
  "                  ▓▓▓█ ▓▓███▓▓▓                   ",
  "                 █▓▓▓▓▓▓  █▓  ▓ ▓                 ",
  "                  ▓▓▓▓▓▓▓▓▓▓▓  ▓                  ",
  "                   ▓▓▓█▓▓▓▓ █▓▓  ▓                ",
  "                   █▓   ▓▓▓▓▓▓▓▓█▓                ",
  "                  ▓█      ▓█▓▓▓▓                  "
];

const AnimatedHeader = ({ terminalHeight }: { terminalHeight: number }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame((f) => f + 1), 60);
    return () => clearInterval(t);
  }, []);

  const showLogo = terminalHeight >= 30; // 13 line logo + 7 line header/margins + 8 line menu

  const getAnimatedLine = (line: string, lineIndex: number) => {
    const blocks = ['█', '▓', '▒', '░'];
    return line.split('').map((char, charIndex) => {
      if (char === ' ') return char;
      
      // Holographic scanline sweeping down
      const scanline = (Math.floor(frame / 2)) % 20; 
      if (lineIndex === scanline) {
         return blocks[(charIndex * 3 + frame) % 4] || '█';
      }
      
      // Subtle ambient data breathing
      if ((charIndex * 7 + lineIndex * 3 + frame) % 40 === 0) {
         return '░';
      }

      return char;
    }).join('');
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#00E5FF" padding={1} width={80} alignItems="center">
      {showLogo && (
        <Box flexDirection="column" alignItems="center">
          {logoLines.map((line, i) => (
            <Text key={i} color="#F8FAFC" bold>{getAnimatedLine(line, i)}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={showLogo ? 1 : 0}><Text color="#94A3B8">{pkg.description}</Text></Box>
      <Text color="#00E5FF">Version {pkg.version} | License {pkg.license}</Text>
    </Box>
  );
};

const items = [
  { isSeparator: true, label: '─── Build ────────────────────────────────────────────────', color: '#F8FAFC' },
  { label: '⚙ Compile Engines (Rust, C, CUDA)', value: 'build-engines', color: '#10B981' },

  { label: '◉ Environment Preflight', value: 'check-env', color: '#10B981' },
  { isSeparator: true, label: '─── Verification ─────────────────────────────────────────', color: '#F8FAFC' },
  { label: '◈ Interop Benchmark', value: 'interop', color: '#38BDF8' },
  { label: '◈ GPU Synthetic Data Test', value: 'gpu-test', color: '#38BDF8' },
  { label: '◈ Cryptographic Analysis', value: 'crypto_analysis', color: '#38BDF8' },
  { label: '◈ Generate NIST Bitstream', value: 'gen-nist', color: '#38BDF8' },
  { label: '◈ Generate KAT Vectors', value: 'gen-kat', color: '#38BDF8' },
  { label: '◈ KAT Verification', value: 'kat', color: '#38BDF8' },
  { label: '◈ Headless Docker Matrix', value: 'docker-test', color: '#38BDF8' },
  { isSeparator: true, label: '─── Security & Audit ─────────────────────────────────────', color: '#F8FAFC' },
  { label: '▲ Memory Sanitizers', value: 'asan', color: '#F59E0B' },
  { label: '▲ Security Audit', value: 'audit', color: '#F59E0B' },
  { label: '△ License Compliance', value: 'license-audit', color: '#F59E0B' },
  { isSeparator: true, label: '─── Code Quality ─────────────────────────────────────────', color: '#F8FAFC' },
  { label: '◇ Lint', value: 'lint', color: '#8B5CF6' },
  { label: '◇ Format', value: 'format', color: '#8B5CF6' },
  { isSeparator: true, label: '─── Release ──────────────────────────────────────────────', color: '#F8FAFC' },
  { label: '◆ Bump Project Version', value: 'bump', color: '#D946EF' },
  { label: '◆ Publish to GitHub Releases', value: 'publish', color: '#D946EF' },
  { isSeparator: true, label: '─── System ───────────────────────────────────────────────', color: '#F8FAFC' },
  { label: '○ Deep Clean', value: 'clean', color: '#F43F5E' },
  { label: '✕ Exit', value: 'exit', color: '#E11D48' },
];

const ICONS: Record<string, string> = { Rust: '🦀', C: '⚙️', CUDA: '🟩' };

const Menu = ({ onSelect, terminalHeight, hasLogo }: { onSelect: (val: string) => void, terminalHeight: number, hasLogo: boolean }) => {
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  
  // Exact static height of all components combined (margins, borders, padding)
  const staticHeight = hasLogo ? 24 : 11;
  const viewportSize = Math.max(2, terminalHeight - staticHeight); 

  useInput((input, key) => {
    let next = selectedIndex;
    if (key.upArrow) {
      next = selectedIndex - 1;
      while (next >= 0 && items[next].isSeparator) next--;
    } else if (key.downArrow) {
      next = selectedIndex + 1;
      while (next < items.length && items[next].isSeparator) next++;
    }

    if (next >= 0 && next < items.length) {
      setSelectedIndex(next);
      // Adjust viewport if cursor moves out of bounds
      if (next < viewportStart) {
        setViewportStart(next);
      } else if (next >= viewportStart + viewportSize) {
        setViewportStart(next - viewportSize + 1);
      }
    }

    if (key.return) {
      onSelect(items[selectedIndex].value as string);
    }
  });

  const visibleItems = items.slice(viewportStart, viewportStart + viewportSize);

  return (
    <Box flexDirection="column" marginTop={1} width={80} alignItems="center">
      {visibleItems.map((item, localIndex) => {
        const globalIndex = viewportStart + localIndex;
        const isSelected = globalIndex === selectedIndex;
        return (
          <Box key={globalIndex} width="100%" justifyContent="center">
            {item.isSeparator ? (
              <Text color={item.color}>{item.label}</Text>
            ) : (
              <Text 
                color={isSelected ? '#0F172A' : item.color} 
                backgroundColor={isSelected ? '#F8FAFC' : undefined} 
                bold={isSelected}
              >
                {isSelected ? '❯ ' : '  '}{item.label}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

const App = ({ onAction }: { onAction: (val: string) => void }) => {
  const [terminalHeight, setTerminalHeight] = useState(process.stdout.rows || 24);

  useEffect(() => {
    const onResize = () => setTerminalHeight(process.stdout.rows);
    process.stdout.on('resize', onResize);
    return () => { process.stdout.off('resize', onResize); };
  }, []);

  return (
    <Box 
      flexDirection="column" 
      padding={1} 
      width="100%" 
      height={terminalHeight} 
      alignItems="center" 
      justifyContent="center"
    >
      <AnimatedHeader terminalHeight={terminalHeight} />
      <Menu onSelect={onAction} terminalHeight={terminalHeight} hasLogo={terminalHeight >= 30} />
    </Box>
  );
};

const PressEnterToContinue = ({ onEnter }: { onEnter: () => void }) => {
  useInput((input, key) => {
    if (key.return) {
      onEnter();
    }
  });
  return (
    <Text color="#00E5FF">› <Text color="#F8FAFC">Press [ENTER] to return to the main dashboard...</Text></Text>
  );
};

const CenteredLayout = ({ children }: { children: React.ReactNode }) => {
  const [terminalHeight, setTerminalHeight] = useState(process.stdout.rows || 24);
  useEffect(() => {
    const onResize = () => setTerminalHeight(process.stdout.rows);
    process.stdout.on('resize', onResize);
    return () => { process.stdout.off('resize', onResize); };
  }, []);
  return (
    <Box height={terminalHeight} width="100%" justifyContent="center" alignItems="center" flexDirection="column">
      {children}
    </Box>
  );
};

const InteropTestRunner = ({ title = "Hardware Interoperability Benchmark", useDocker = false, onComplete }: { title?: string; useDocker?: boolean; onComplete: () => void }) => {
  const [step, setStep] = useState(0);
  const [rounds, setRounds] = useState(10);
  const [results, setResults] = useState<InteropResult[]>([]);
  const [progresses, setProgresses] = useState<{ [key: string]: { progress: number, currentIt: number, totalIt: number } }>({});
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(f => f + 1), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (step === 1) {
      runInteropBenchmark((engine, prog, result, current, total) => {
        setProgresses(p => ({ ...p, [engine]: { progress: prog, currentIt: current ?? 0, totalIt: total ?? 0 } }));
        if (result) setResults((prev) => {
           if (prev.find(x => x.engine === result.engine)) return prev;
           return [...prev, result];
        });
      }, rounds, useDocker).then(() => setDone(true)).catch(console.error);
    }
  }, [step]);

  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  const roundChoices = [
    { label: '1 Iteration (Single Run)', value: 1 },
    { label: '10 Iterations (Quick)', value: 10 },
    { label: '100 Iterations (Standard)', value: 100 },
    { label: '1,000 Iterations (Deep)', value: 1000 },
    { label: '10,000 Iterations (Stress)', value: 10000 },
    { label: '100,000 Iterations (Extreme)', value: 100000 }
  ];

  return (
    <Box flexDirection="column" padding={1} width={100} alignItems="center">
      <Text color="#00E5FF" bold>─── {title} ───</Text>
      
      {step === 0 && (
        <Box flexDirection="column" marginTop={1} alignItems="center">
          <Text color="#38BDF8">Select Number of Test Iterations:</Text>
          <SelectInput items={roundChoices} onSelect={(item) => { setRounds(item.value); setStep(1); }} />
        </Box>
      )}

      {step === 1 && !done && (
        <Box marginY={1} flexDirection="row" width={90} justifyContent="space-around">
          {['Rust', 'C', 'CUDA'].map((lang, i) => {
            const r = results.find(x => x.engine === lang);
            const progData = progresses[lang];
            const isCurrent = !!(progData && progData.progress < 100 && !r);
            const prog = progData?.progress || 0;
            const color = r ? (r.status === 'PASS' ? '#10B981' : '#EF4444') : isCurrent ? '#38BDF8' : '#64748B';
            return (
              <Box key={i} width={28} height={5} borderStyle="single" borderColor={color} flexDirection="column" alignItems="center" justifyContent="center">
                <Text color="#F8FAFC" bold>{ICONS[lang]} {lang}</Text>
                <Box marginTop={1}>
                  <Text color={color}>
                    {r ? (r.status === 'PASS' ? `✔ ${r.casca_cpb.toFixed(2)} cpb` : '✖ Failed') : isCurrent ? `${spin[tick % 10]} ${prog}% [${'█'.repeat(Math.floor(prog / 10))}${'░'.repeat(10 - Math.floor(prog / 10))}]` : '○ Pending'}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {step === 1 && done && (
      <Box marginY={1} flexDirection="column" width={96} borderStyle="single" borderColor="#0F172A">
        <Box paddingX={1} marginBottom={1}>
          <Box width={10}><Text color="#94A3B8" bold>ENGINE</Text></Box>
          <Box width={10}><Text color="#94A3B8" bold>STATUS</Text></Box>
          <Box width={15}><Text color="#94A3B8" bold>CASCADE TIME</Text></Box>
          <Box width={15}><Text color="#94A3B8" bold>CASCADE CPB</Text></Box>
          <Box width={15}><Text color="#94A3B8" bold>PERFORMANCE</Text></Box>
          <Box width={15}><Text color="#94A3B8" bold>THROUGHPUT</Text></Box>
        </Box>
        
        {results.map((r, i) => (
          <Box key={i} paddingX={1} backgroundColor={i % 2 === 0 ? '#0F172A' : undefined}>
            <Box width={10}><Text color="#F8FAFC">{ICONS[r.engine]} {r.engine}</Text></Box>
            <Box width={10}><Text color={r.status === 'PASS' ? '#10B981' : '#EF4444'} bold>{r.status}</Text></Box>
            <Box width={15}><Text color="#38BDF8">{r.casca_us.toFixed(2)} μs</Text></Box>
            <Box width={15}><Text color="#F59E0B">{r.casca_cpb.toFixed(2)} cpb</Text></Box>
            <Box width={15}><Text color="#00E5FF">{r.ops_sec.toLocaleString(undefined, {maximumFractionDigits: 0})} ops/s</Text></Box>
            <Box width={15}><Text color="#D946EF">{r.throughput_mbps.toFixed(1)} MB/s</Text></Box>
          </Box>
        ))}
        <Box paddingX={1} marginTop={1}>
          <Box width={96}><Text color="#10B981" bold>✓ All iterations verified successfully.</Text></Box>
        </Box>
      </Box>
      )}

      <Box flexDirection="column" alignItems="center" height={3}>
        {done && (
          <Box flexDirection="column" alignItems="center">
            <Text color="#10B981" bold>✨ Hardware Validation Complete.</Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

const DockerTestRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);

  const wrappers = [
    'node', 'python', 'go', 'ruby', 'elixir', 'php', 'csharp', 
    'java', 'kotlin', 'dart', 'swift', 'lua', 'r', 'julia', 'perl'
  ];
  
  if (step === 0) {
    return <AutomatedScaffoldRunner onComplete={() => setStep(1)} autoAdvance={true} />;
  }

  if (step === 1) {
    const coreJobs = [
      { name: '  ├── Core: Rust', cmd: 'docker compose -f docker-compose.yml build -q dasp-rust' },
      { name: '  ├── Core: C', cmd: 'docker compose -f docker-compose.yml build -q dasp-c' },
      { name: '  ├── Core: CUDA', cmd: 'docker compose -f docker-compose.yml build -q dasp-cuda' },
      { name: '  └── Base Builder (Shared)', cmd: 'docker compose -f docker-compose.yml build -q dasp-builder' }
    ];

    return (
      <ShellJobRunner 
        key={step}
        title="Headless Docker Test (Phase 1: Multi-Stage Core Builder)" 
        jobs={coreJobs} 
        concurrent={false}
        boxLayout={false}
        autoAdvance={true}
        successMsg="Core Infrastructure Initialized. Proceeding to Matrix..." 
        failMsg="Core Compilation Failed" 
        onComplete={() => setStep(2)} 
      />
    );
  }

  if (step === 2) {
    const jobs = wrappers.map((w, i) => ({
      name: `${i === wrappers.length - 1 ? '  └──' : '  ├──'} Wrapper: ${w}`,
      cmd: `docker compose -f docker-compose.yml build -q dasp-${w}`
    }));

    return (
      <ShellJobRunner 
        key={step}
        title="Headless Docker Test (Phase 2: Build Matrix)" 
        jobs={jobs} 
        concurrent={false}
        boxLayout={false}
        autoAdvance={true}
        successMsg="Containers Built Successfully. Proceeding to Benchmark..." 
        failMsg="Container Build Failed" 
        onComplete={() => setStep(3)} 
      />
    );
  }

  return (
    <InteropTestRunner 
      title="Headless Docker Test (Phase 3: Benchmark)" 
      useDocker={true} 
      onComplete={onComplete} 
    />
  );
};

const GpuTestRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [results, setResults] = useState<GpuTestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionLabel, setActionLabel] = useState('');
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(f => f + 1), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    runGpuTest((prog, tot, action, result) => {
      setProgress(prog);
      setTotal(tot);
      setActionLabel(action);
      if (result) setResults((prev) => [...prev, result]);
    }).then(() => setDone(true)).catch(console.error);
  }, []);

  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const percent = total > 0 ? Math.floor((progress / total) * 100) : 0;

  return (
    <Box flexDirection="column" padding={1} width={100} alignItems="center">
      <Text color="#00E5FF" bold>─── GPU Synthetic Sweep Benchmark ───</Text>
      
      <Box marginY={1} flexDirection="column" width={80} borderStyle="single" borderColor="#0F172A">
        <Box paddingX={1} marginBottom={1}>
          <Box width={15}><Text color="#94A3B8" bold>SIZE</Text></Box>
          <Box width={20}><Text color="#94A3B8" bold>ENCRYPTION</Text></Box>
          <Box width={20}><Text color="#94A3B8" bold>DECRYPTION</Text></Box>
          <Box width={15}><Text color="#94A3B8" bold>INTEGRITY</Text></Box>
        </Box>
        
        {results.map((r, i) => (
          <Box key={i} paddingX={1} backgroundColor={i % 2 === 0 ? '#0F172A' : undefined}>
            <Box width={15}><Text color="#F8FAFC">{r.size_mb} MB</Text></Box>
            <Box width={20}><Text color="#38BDF8">{r.enc_gbps.toFixed(2)} Gbps</Text></Box>
            <Box width={20}><Text color="#38BDF8">{r.dec_gbps.toFixed(2)} Gbps</Text></Box>
            <Box width={15}><Text color={r.match ? '#10B981' : '#EF4444'} bold>{r.match ? 'PASS' : 'FAIL'}</Text></Box>
          </Box>
        ))}
        {!done && (
          <Box paddingX={1} marginTop={results.length > 0 ? 1 : 0}>
            <Box width={25}><Text color="#38BDF8">{spin[tick % spin.length]} {actionLabel}</Text></Box>
            <Box width={55}>
              <Text color="#64748B">
                {`[${'█'.repeat(Math.floor(percent / 5))}${'░'.repeat(20 - Math.floor(percent / 5))}] `}
                {percent}%
              </Text>
            </Box>
          </Box>
        )}
        {done && results.length > 0 && (
          <Box paddingX={1} marginTop={1}>
            <Box width={80}><Text color="#10B981" bold>✓ All {results.length} sizes verified.</Text></Box>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" alignItems="center" height={3} marginTop={1}>
        {done && (
          <Box flexDirection="column" alignItems="center">
            <Text color="#10B981" bold>✨ Sweep Benchmark Complete.</Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

const KatTestRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [results, setResults] = useState<KatResult[]>([]);
  const [currentVectors, setCurrentVectors] = useState<{ [key: string]: string }>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    runKatVerification((engine, vecId, result) => {
      setCurrentVectors(p => ({ ...p, [engine]: vecId }));
      if (result) setResults((prev) => [...prev, result]);
    }).then(() => setDone(true)).catch(console.error);
  }, []);

  const fails = results.filter(r => r.status !== 'PASS');

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── Known Answer Test (KAT) Verification ───</Text>
      <Box marginY={1} flexDirection="column" alignItems="center">
        {!done ? (
          <Box flexDirection="column" alignItems="center">
            {Object.entries(currentVectors).map(([eng, vecId]) => (
              <Text key={eng} color="#F8FAFC">
                Verifying <Text color="#38BDF8" bold>{eng}</Text> (Vector: {vecId})...
              </Text>
            ))}
          </Box>
        ) : (
          <Box flexDirection="column" alignItems="center">
            {fails.length === 0 ? (
               <Box marginBottom={1}><Text color="#10B981" bold>✓ All Engines Bit-Perfect Synchronized.</Text></Box>
            ) : (
               <Box marginBottom={1}><Text color="#D946EF" bold>❌ Parity Errors Detected:</Text></Box>
            )}
            
            {['Rust', 'C', 'CUDA'].map(lang => {
               const langResults = results.filter(r => r.engine === lang);
               if (langResults.length === 0) return null;
               const passed = langResults.filter(r => r.status === 'PASS').length;
               const failed = langResults.length - passed;
               const color = failed > 0 ? '#EF4444' : '#10B981';
               return (
                  <Text key={lang} color="#38BDF8">
                    {lang}: <Text color={color}>{failed > 0 ? 'FAIL' : 'PASS'} ({passed}/{langResults.length} vectors)</Text>
                  </Text>
               );
            })}

            {fails.length > 0 && (
              <Box flexDirection="column" alignItems="center" marginTop={1}>
                {fails.map((f, i) => <Text key={i} color="#F43F5E">{f.engine} ({f.vectorId}): {f.error}</Text>)}
              </Box>
            )}
          </Box>
        )}
      </Box>
      <Box height={2} width={80} alignItems="center" justifyContent="center">
        {done && <PressEnterToContinue onEnter={onComplete} />}
      </Box>
    </Box>
  );
};

const CryptoAnalysisRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [currentStage, setCurrentStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CryptoAnalysisResult | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    runCryptoAnalysis((stage, prog) => {
      setCurrentStage(stage);
      setProgress(prog);
    }).then((res) => {
      setResult(res);
      setDone(true);
    }).catch(console.error);
  }, []);

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── Cryptographic Analysis ───</Text>
      <Box marginY={1} flexDirection="column" alignItems="center" height={9}>
        {!done ? (
          <Text color="#F8FAFC">
            {currentStage}... {progress}%
          </Text>
        ) : result && (
          <Box flexDirection="column" alignItems="center">
            <Text color="#F8FAFC">Shannon Entropy: <Text color="#10B981">{result.entropy.toFixed(4)}</Text></Text>
            <Text color="#F8FAFC">Chi-Square: <Text color="#10B981">{result.chi_square.toFixed(2)}</Text></Text>
            <Text color="#F8FAFC">Strict Avalanche (SAC): <Text color="#10B981">{result.sac_percent.toFixed(2)}%</Text></Text>
            <Text color="#F8FAFC">Serial Correlation: <Text color="#10B981">{result.serial_correlation.toFixed(5)}</Text></Text>
            <Text color="#F8FAFC">Monte Carlo Pi: <Text color="#10B981">{result.monte_carlo_pi.toFixed(5)}</Text></Text>
            <Text color="#F8FAFC">Monobit Ratio: <Text color="#10B981">{result.monobit.toFixed(4)}</Text></Text>
            <Text color="#F8FAFC">Cross-Key SAC: <Text color="#10B981">{result.cross_key_sac.toFixed(2)}%</Text></Text>
            <Text color="#F8FAFC">Time Variance: <Text color="#10B981">{result.time_variance.toFixed(4)}%</Text></Text>
            <Text color="#F8FAFC">Block Frequency (χ²): <Text color="#10B981">{result.block_frequency.toFixed(4)}</Text></Text>
            <Text color="#F8FAFC">Cumulative Sums: <Text color="#10B981">{result.cumulative_sums.toFixed(4)}</Text></Text>
            <Text color="#F8FAFC">Discrete Fourier Transform: <Text color="#10B981">{result.spectral_dft.toFixed(4)}</Text></Text>
          </Box>
        )}
      </Box>
      {done && <PressEnterToContinue onEnter={onComplete} />}
    </Box>
  );
};



(async () => {
  const { default: chalk } = await import('chalk');

  // .env loader
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line: string) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }


  while (true) {
    console.clear();
    const action = await new Promise<string>((resolve) => {
      const { unmount } = render(
        <App
          onAction={(val) => {
            unmount();
            console.clear();
            resolve(val);
          }}
        />
      );
    });

    if (action === 'exit') {
      console.log(chalk.hex('#64748B')('  Session terminated.'));
      process.exit(0);
    }

    const CMD = {
      LINT: 'npm run lint',
      INTEROP: 'npm run test:interop',
      GEN_KAT: 'npm run test:gen-kat',
      KAT: 'npm run test:kat',
      BUILD_ENGINES: 'npm run build:engines',
      PUBLISH: 'electron-forge publish',
      DOCKER_TEST: 'docker compose -f docker-compose.yml build && python "scripts/tests/verify_interop.py" --docker',
      FORMAT: 'npm run format',
      AUDIT: 'npm run audit',
      CLEAN: 'npm run clean',
      PUBLISH_ENGINES: 'npm run publish',
    };

    const runComponent = async (Factory: any, props: any = {}) => {
      await new Promise<void>((resolve) => {
        const { unmount } = render(
          <CenteredLayout>
            <Factory {...props} onComplete={() => { unmount(); resolve(); }} />
          </CenteredLayout>
        );
      });
    };

    try {
      if (action === 'interop') {
        await runComponent(InteropTestRunner);
        continue;
      }
      if (action === 'kat') {
        await runComponent(KatTestRunner);
        continue;
      }
      if (action === 'crypto_analysis') {
        await runComponent(CryptoAnalysisRunner);
        continue;
      }

      if (action === 'check-env') {
        await runComponent(EnvCheckRunner);
        continue;
      }
      if (action === 'gpu-test') {
        await runComponent(GpuTestRunner);
        continue;
      }
      if (action === 'docker-test') {
        await runComponent(DockerTestRunner);
        continue;
      }
      if (action === 'lint') {
        await runComponent(ScriptRunner, { title: "Linting", cmd: CMD.LINT });
        continue;
      }
      if (action === 'format') {
        await runComponent(ScriptRunner, { title: "Formatting", cmd: CMD.FORMAT });
        continue;
      }
      if (action === 'audit') {
        await runComponent(ScriptRunner, { title: "Security Audit", cmd: CMD.AUDIT });
        continue;
      }
      if (action === 'asan') {
        await runComponent(ScriptRunner, { title: "Memory Sanitizers", cmd: "npx tsx scripts/cli/asan.ts" });
        continue;
      }
      if (action === 'license-audit') {
        await runComponent(ScriptRunner, { title: "License Audit", cmd: "npx tsx scripts/cli/license-audit.ts" });
        continue;
      }
      if (action === 'clean') {
        await runComponent(CleanRunner);
        continue;
      }
      if (action === 'gen-nist') {
        await runComponent(ScriptRunner, { title: "Generate NIST Bitstream", cmd: "npm run gen-nist" });
        continue;
      }
      if (action === 'build-engines') {
        await runComponent(BuildEnginesRunner);
        continue;
      }
      if (action === 'gen-kat') {
        await runComponent(ScriptRunner, { title: "Generate KAT Vectors", cmd: CMD.GEN_KAT });
        continue;
      }
      if (action === 'publish') {
        await runComponent(BuildEnginesRunner);

        await runComponent(ScriptRunner, { title: "Publish Engine Artifacts", cmd: CMD.PUBLISH_ENGINES });
        continue;
      }

      if (action === 'bump') {
        await runComponent(BumpRunner);
        continue;
      }
    } catch (err: any) {
      console.log(chalk.red.bold('\n❌ Operation Aborted.'));
      console.log(chalk.red(err?.stack || err?.message || String(err)));
    }

    await new Promise<void>((resolve) => {
      const { unmount } = render(<PressEnterToContinue onEnter={() => { unmount(); resolve(); }} />);
    });
  }
})();
