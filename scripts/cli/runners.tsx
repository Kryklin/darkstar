import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = require('../../package.json');

// ─── Shared Utilities ───

export const stripAnsi = (s: string) =>
  s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

export const PressEnterToContinue = ({ onEnter }: { onEnter: () => void }) => {
  useInput((_input, key) => {
    if (key.return) onEnter();
  });
  return (
    <Text color="#00E5FF">› <Text color="#F8FAFC">Press [ENTER] to return to the main dashboard...</Text></Text>
  );
};

// ─── ShellJobRunner ───
// Runs multiple shell commands sequentially with animated status

export type ShellJob = { name: string; cmd: string; cwd?: string };
type JobState = ShellJob & { status: 'pending' | 'running' | 'pass' | 'fail'; detail?: string };

export const ShellJobRunner = ({ title, jobs, successMsg, failMsg, concurrent = false, boxLayout = false, autoAdvance = false, onComplete }: {
  title: string; jobs: ShellJob[]; successMsg: string; failMsg: string; concurrent?: boolean; boxLayout?: boolean; autoAdvance?: boolean; onComplete: () => void;
}) => {
  const [states, setStates] = useState<JobState[]>(jobs.map(j => ({ ...j, status: 'pending' as const })));
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(f => f + 1), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { execa } = await import('execa');
      
      if (concurrent) {
        setStates(p => p.map(s => ({ ...s, status: 'running' as const })));
        await Promise.all(jobs.map(async (job, i) => {
          try {
            await execa(job.cmd, { shell: true, cwd: job.cwd });
            setStates(p => p.map((s, idx) => idx === i ? { ...s, status: 'pass' as const } : s));
          } catch (e: any) {
            const raw = e.stderr || e.stdout || e.message || '';
            const detail = stripAnsi(raw).split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 70) || '';
            setStates(p => p.map((s, idx) => idx === i ? { ...s, status: 'fail' as const, detail } : s));
          }
        }));
      } else {
        for (let i = 0; i < jobs.length; i++) {
          setStates(p => p.map((s, idx) => idx === i ? { ...s, status: 'running' as const } : s));
          try {
            await execa(jobs[i].cmd, { shell: true, cwd: jobs[i].cwd });
            setStates(p => p.map((s, idx) => idx === i ? { ...s, status: 'pass' as const } : s));
          } catch (e: any) {
            const raw = e.stderr || e.stdout || e.message || '';
            const detail = stripAnsi(raw).split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 70) || '';
            setStates(p => p.map((s, idx) => idx === i ? { ...s, status: 'fail' as const, detail } : s));
          }
        }
      }
      setDone(true);
    })();
  }, []);

  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const allPassed = states.every(s => s.status === 'pass');

  useEffect(() => {
    if (done && allPassed && autoAdvance) {
      const t = setTimeout(() => onComplete(), 1000);
      return () => clearTimeout(t);
    }
  }, [done, allPassed, autoAdvance]);

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── {title} ───</Text>
      {boxLayout ? (
        <Box marginY={1} flexDirection="row" width={90} justifyContent="space-around">
          {states.map((s, i) => {
            const color = s.status === 'pass' ? '#10B981' : s.status === 'fail' ? '#EF4444' : s.status === 'running' ? '#38BDF8' : '#64748B';
            const shortName = s.name.replace('Build ', '').replace(' Container', '');
            return (
              <Box key={i} width={28} height={5} borderStyle="single" borderColor={color} flexDirection="column" alignItems="center" justifyContent="center">
                <Text color="#F8FAFC" bold>{shortName}</Text>
                <Box marginTop={1}>
                  <Text color={color}>
                    {s.status === 'running' ? spin[tick % 10] + ' Building...' : s.status === 'pass' ? '✔ Complete' : s.status === 'fail' ? '✖ Failed' : '○ Pending'}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box marginY={1} flexDirection="column" width={72}>
          {states.map((s, i) => (
            <Box key={i} flexDirection="column">
              <Text color={s.status === 'pass' ? '#10B981' : s.status === 'fail' ? '#EF4444' : s.status === 'running' ? '#38BDF8' : '#64748B'}>
                {s.status === 'running' ? spin[tick % 10] : s.status === 'pass' ? '✔' : s.status === 'fail' ? '✖' : '○'} {s.name}
              </Text>
              {s.status === 'fail' && s.detail && <Text color="#64748B">    {s.detail}</Text>}
            </Box>
          ))}
        </Box>
      )}
      <Box flexDirection="column" alignItems="center" height={3}>
        {done && (!allPassed || !autoAdvance) && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color={allPassed ? '#10B981' : '#EF4444'} bold>{allPassed ? successMsg : failMsg}</Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── ScriptRunner ───
// Runs a single shell command with live captured output

export const ScriptRunner = ({ title, cmd, cwd, onComplete }: {
  title: string; cmd: string; cwd?: string; onComplete: () => void;
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(f => f + 1), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { execa } = await import('execa');
      try {
        const proc = execa(cmd, { shell: true, cwd: cwd || process.cwd() });
        const onData = (data: Buffer) => {
          const newLines = stripAnsi(data.toString()).split('\n').filter((l: string) => l.trim());
          setLines(prev => [...prev.slice(-20), ...newLines]);
        };
        proc.stdout?.on('data', onData);
        proc.stderr?.on('data', onData);
        await proc;
      } catch (e: any) {
        setSuccess(false);
        const err = stripAnsi(e.stderr || e.stdout || e.message || '');
        setLines(prev => [...prev, ...err.split('\n').filter(Boolean).slice(-5)]);
      }
      setDone(true);
    })();
  }, []);

  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── {title} ───</Text>
      <Box marginY={1} flexDirection="column" width={76} alignItems="center">
        {!done ? (
          <Text color="#38BDF8">
            {spin[tick % 10]} <Text color="#64748B" wrap="truncate-end">{lines[lines.length - 1]?.slice(0, 70) || 'Executing...'}</Text>
          </Text>
        ) : (
          <Text color={success ? '#10B981' : '#EF4444'} bold>
            {success ? `✔ ${title} Complete` : `✖ ${title} Failed`}
          </Text>
        )}
      </Box>
      <Box flexDirection="column" alignItems="center" height={2}>
        {done && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── CleanRunner ───

export const CleanRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [items, setItems] = useState<{ name: string; status: 'deleted' | 'skipped' | 'error' }[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const targets = ['node_modules', 'dist', 'out', 'out-releases', 'rust/target', 'c/dasp.exe', 'cuda/d-asp_cuda.exe'];
    const root = path.join(__dirname, '../..');
    const res: typeof items = [];
    for (const t of targets) {
      const fp = path.join(root, t);
      if (fs.existsSync(fp)) {
        try { fs.rmSync(fp, { recursive: true, force: true }); res.push({ name: t, status: 'deleted' }); }
        catch { res.push({ name: t, status: 'error' }); }
      } else {
        res.push({ name: t, status: 'skipped' });
      }
    }
    setItems(res);
    setDone(true);
  }, []);

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── Deep Clean ───</Text>
      <Box marginY={1} flexDirection="column" width={72}>
        {items.map((it, i) => (
          <Text key={i} color={it.status === 'deleted' ? '#10B981' : it.status === 'skipped' ? '#64748B' : '#EF4444'}>
            {it.status === 'deleted' ? '✔' : it.status === 'skipped' ? '–' : '✖'} {it.name}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" alignItems="center" height={3}>
        {done && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color="#10B981" bold>Workspace purge complete.</Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── EnvCheckRunner ───

export const EnvCheckRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [checks, setChecks] = useState<{ name: string; status: 'pending' | 'checking' | 'pass' | 'fail' }[]>([]);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(f => f + 1), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { execa } = await import('execa');
      const deps: { name: string; cmd: string; args: string[]; fallbackCmd?: string; fallbackArgs?: string[] }[] = [
        { name: 'C Compiler (clang)', cmd: 'clang', args: ['--version'], fallbackCmd: 'gcc', fallbackArgs: ['--version'] },
        { name: 'Rust (cargo)', cmd: 'cargo', args: ['--version'] },
        { name: 'CUDA (nvcc)', cmd: 'nvcc', args: ['--version'] },
        { name: 'Python', cmd: 'python', args: ['--version'] },
        { name: 'Node.js', cmd: 'node', args: ['--version'] },
      ];
      const res: typeof checks = [];
      for (const dep of deps) {
        res.push({ name: dep.name, status: 'checking' });
        setChecks([...res]);
        let passed = false;
        try {
          await execa(dep.cmd, dep.args, { shell: process.platform === 'win32' });
          passed = true;
        } catch {
          if (dep.fallbackCmd) {
            try { await execa(dep.fallbackCmd, dep.fallbackArgs!, { shell: process.platform === 'win32' }); passed = true; } catch {}
          }
        }
        res[res.length - 1].status = passed ? 'pass' : 'fail';
        setChecks([...res]);
      }
      setDone(true);
    })();
  }, []);

  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const allPassed = done && checks.every(c => c.status === 'pass');

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── Environment Preflight ───</Text>
      <Box marginY={1} flexDirection="column" width={72}>
        {checks.map((c, i) => (
          <Text key={i} color={c.status === 'pass' ? '#10B981' : c.status === 'fail' ? '#EF4444' : '#38BDF8'}>
            {c.status === 'checking' ? spin[tick % 10] : c.status === 'pass' ? '✔' : c.status === 'fail' ? '✖' : '○'} {c.name}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" alignItems="center" height={3}>
        {done && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color={allPassed ? '#10B981' : '#EF4444'} bold>
              {allPassed ? '✔ All development tools detected!' : '✖ Some tools are missing.'}
            </Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── BumpRunner ───

export const BumpRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'input' | 'running' | 'done'>('input');
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(true);

  useInput((ch, key) => {
    if (phase !== 'input') return;
    if (key.return && input.match(/^\d+\.\d+\.\d+(-.*)?$/)) {
      setPhase('running');
    } else if (key.backspace || key.delete) {
      setInput(v => v.slice(0, -1));
    } else if (ch && !key.ctrl && !key.meta) {
      setInput(v => v + ch);
    }
  });

  useEffect(() => {
    if (phase !== 'running') return;
    (async () => {
      try {
        const { execa } = await import('execa');
        const root = path.join(__dirname, '../..');
        await execa('npm', ['version', input, '--no-git-tag-version', '--allow-same-version'], { cwd: root });

        const nodeDir = path.join(root, 'node');
        if (fs.existsSync(nodeDir)) {
          try { await execa('npm', ['version', input, '--no-git-tag-version', '--allow-same-version'], { cwd: nodeDir }); } catch {}
        }

        const cargoPath = path.join(root, 'rust', 'Cargo.toml');
        if (fs.existsSync(cargoPath)) {
          let cargo = fs.readFileSync(cargoPath, 'utf8');
          cargo = cargo.replace(/^version\s*=\s*".*?"/m, `version = "${input}"`);
          fs.writeFileSync(cargoPath, cargo);
        }

        const readmePath = path.join(root, 'README.md');
        if (fs.existsSync(readmePath)) {
          let readme = fs.readFileSync(readmePath, 'utf8');
          const esc = pkg.version.replace(/\./g, '\\.');
          readme = readme.replace(new RegExp(`Version-${esc}-blue`, 'g'), `Version-${input}-blue`);
          fs.writeFileSync(readmePath, readme);
        }

        setMessage(`Successfully bumped all manifests to v${input}!`);
        setOk(true);
      } catch (e: any) {
        setMessage(`Failed: ${e.message}`);
        setOk(false);
      }
      setPhase('done');
    })();
  }, [phase]);

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#F8FAFC" bold>─── Bump Project Version ───</Text>
      {phase === 'input' && (
        <Box flexDirection="column" marginTop={1} alignItems="center">
          <Text color="#38BDF8">Current: <Text color="#F8FAFC" bold>v{pkg.version}</Text></Text>
          <Box marginTop={1}>
            <Text color="#38BDF8">New version: </Text>
            <Text color="#F8FAFC" bold>{input}<Text color="#00E5FF">▌</Text></Text>
          </Box>
          <Box marginTop={1}><Text color="#64748B">Enter semver (e.g. 1.0.6) then press ENTER</Text></Box>
        </Box>
      )}
      {phase === 'running' && (
        <Box marginTop={1}><Text color="#38BDF8">◐ Bumping to v{input}...</Text></Box>
      )}
      <Box flexDirection="column" alignItems="center" height={3} marginTop={1}>
        {phase === 'done' && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color={ok ? '#10B981' : '#EF4444'} bold>{message}</Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};


// ─── BuildEnginesRunner ───
export const BuildEnginesRunner = ({ onComplete }: { onComplete: () => void }) => {
  const [states, setStates] = useState<Record<string, 'pending' | 'running' | 'pass' | 'fail'>>({
    rust: 'pending',
    wasm: 'pending',
    c: 'pending',
    cuda: 'pending'
  });
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(f => f + 1), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { execa } = await import('execa');
      const engines = [
        { id: 'rust', name: 'Rust Core Engine', cmd: 'npm run build:rust' },
        { id: 'wasm', name: 'WebAssembly Fallback', cmd: 'npm run build:wasm' },
        { id: 'c', name: 'C-FFI AVX2 Engine', cmd: 'npm run build:c' },
        { id: 'cuda', name: 'CUDA GPU Pipeline', cmd: 'npm run build:cuda' }
      ];
      
      for (const e of engines) {
        setStates(p => ({ ...p, [e.id]: 'running' }));
        try {
          await execa(e.cmd, { shell: true });
          setStates(p => ({ ...p, [e.id]: 'pass' }));
        } catch (err) {
          setStates(p => ({ ...p, [e.id]: 'fail' }));
        }
      }
      setDone(true);
    })();
  }, []);

  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const getIcon = (s: string) => {
    if (s === 'running') return <Text color="#38BDF8">{spin[tick % spin.length]}</Text>;
    if (s === 'pass') return <Text color="#10B981">✔</Text>;
    if (s === 'fail') return <Text color="#EF4444">✖</Text>;
    return <Text color="#64748B">○</Text>;
  };
  const getColor = (s: string) => s === 'pass' ? '#10B981' : s === 'fail' ? '#EF4444' : s === 'running' ? '#F8FAFC' : '#64748B';

  const allPassed = Object.values(states).every(s => s === 'pass');

  return (
    <Box flexDirection="column" padding={1} width={80} alignItems="center">
      <Text color="#00E5FF" bold>─── Building Cryptographic Engines ───</Text>
      <Box marginY={1} flexDirection="column" width={72}>
        <Text color="#F8FAFC" bold>Darkstar Compilation Target</Text>
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text color={getColor(states.rust)}>├─ {getIcon(states.rust)} Rust Core Engine</Text>
          <Text color={getColor(states.wasm)}>├─ {getIcon(states.wasm)} WebAssembly Fallback</Text>
          <Text color={getColor(states.c)}>├─ {getIcon(states.c)} C-FFI AVX2 Engine</Text>
          <Text color={getColor(states.cuda)}>├─ {getIcon(states.cuda)} CUDA GPU Pipeline</Text>
          <Text color={getColor(states.zig)}>└─ {getIcon(states.zig)} Zig Node API Wrapper</Text>
        </Box>
      </Box>
      <Box flexDirection="column" alignItems="center" height={3}>
        {done && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color={allPassed ? '#10B981' : '#EF4444'} bold>
              {allPassed ? '✔ All engines compiled successfully.' : '✖ Engine compilation failed.'}
            </Text>
            <PressEnterToContinue onEnter={onComplete} />
          </Box>
        )}
      </Box>
    </Box>
  );
};
