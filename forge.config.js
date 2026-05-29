const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

const ext = process.platform === 'win32' ? '.exe' : '';

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, 'public/favicon'),
    extraResource: [
      path.join(__dirname, `d-asp/rust/target/release/d-asp${ext}`),
      path.join(__dirname, `d-asp/go/main${ext}`),
      path.join(__dirname, `d-asp/c/dasp${ext}`),
      path.join(__dirname, 'd-asp/node/dasp.js'),
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: path.resolve(__dirname, 'public/favicon.ico'),
        loadingGif: path.resolve(__dirname, 'public/assets/img/splash_installer.gif'),
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        setupExe: 'Darkstar Setup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    postMake: async (config, makeResults) => {
      const { execSync } = require('child_process');
      const fs = require('fs');

      console.log('Running checksums hook...');
      execSync('npm run checksums', { stdio: 'inherit' });

      const checksumPath = path.join(__dirname, 'checksums.txt');
      if (fs.existsSync(checksumPath) && makeResults.length > 0) {
        // Inject checksums.txt into the artifacts of the first makeResult
        makeResults[0].artifacts.push(checksumPath);
      }
      return makeResults;
    },
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'Kryklin',
          name: 'darkstar',
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
};
