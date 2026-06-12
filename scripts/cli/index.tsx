import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import SelectInput from 'ink-select-input';
import { ShellJobRunner, ScriptRunner, CleanRunner, EnvCheckRunner, BumpRunner, BuildEnginesRunner, ScaffoldRunner, DockerMatrixRunner } from './runners.js';


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
    const blocks = ['█', '▓', '▒', '░', 'x', '0', '1'];
    
    // Global glitch trigger (every ~2 seconds)
    const isGlitching = Math.random() < 0.05 && frame % 30 < 5;
    
    let renderedLine = line.split('').map((char, charIndex) => {
      if (char === ' ') return char;
      
      if (isGlitching && Math.random() < 0.3) {
        return blocks[Math.floor(Math.random() * blocks.length)];
      }

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

    // Shift line during glitch
    if (isGlitching) {
      const shift = Math.floor(Math.random() * 5) - 2;
      if (shift > 0) renderedLine = ' '.repeat(shift) + renderedLine.substring(0, renderedLine.length - shift);
      else if (shift < 0) renderedLine = renderedLine.substring(-shift) + ' '.repeat(-shift);
    }

    let color = "#F8FAFC";
    if (isGlitching) {
      const colors = ["#FF003C", "#00E5FF", "#F8FAFC", "#F59E0B"];
      color = colors[Math.floor(Math.random() * colors.length)];
    }

    return <Text key={lineIndex} color={color} bold>{renderedLine}</Text>;
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#00E5FF" padding={1} width={80} alignItems="center">
      {showLogo && (
        <Box flexDirection="column" alignItems="center">
          {logoLines.map((line, i) => getAnimatedLine(line, i))}
        </Box>
      )}
      <Box marginTop={showLogo ? 1 : 0}><Text color="#00E5FF">Version {pkg.version} | License {pkg.license}</Text></Box>
    </Box>
  );
};

const items = [
  { isSeparator: true, label: '─── Build ────────────────────────────────────────────────', color: '#F8FAFC' },
  { label: '⚙ Compile Engines (Rust, C, CUDA)', value: 'build-engines', color: '#10B981' },

  { label: '◉ Environment Preflight', value: 'check-env', color: '#10B981' },
  { isSeparator: true, label: '─── Verification ─────────────────────────────────────────', color: '#F8FAFC' },
  { label: '◈ Enter Rust Test Suite', value: 'rust-test-suite', color: '#38BDF8' },
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
      const RUST_TEST_SUITE = path.resolve(__dirname, '../../rust/target/release/test_suite.exe');
      if (action === 'rust-test-suite') {
          if (!fs.existsSync(RUST_TEST_SUITE)) {
              console.log(chalk.red.bold('\n❌ Operation Aborted.'));
              console.log(chalk.red(`Rust Test Suite is not compiled.\nPlease compile it first using "Compile Engines" from the main menu.\nMissing: ${RUST_TEST_SUITE}`));
              await new Promise<void>((resolve) => {
                const { unmount } = render(<PressEnterToContinue onEnter={() => { unmount(); resolve(); }} />);
              });
              continue;
          }
          
          console.clear();
          const { spawnSync } = await import('child_process');
          spawnSync(RUST_TEST_SUITE, [], { stdio: 'inherit' });
          console.clear();
          process.exit(0);
      }

      if (action === 'check-env') {
        await runComponent(EnvCheckRunner);
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
