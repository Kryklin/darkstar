<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" alt="Darkstar Logo" width="400">
  </picture>
</p>

<h1 align="center">Darkstar</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.1-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/Angular-v20.3.0-dd0031?logo=angular" alt="Angular"/>
  <img src="https://img.shields.io/badge/Angular%20Material-v20.2.5-blue?logo=angular" alt="Angular Material"/>
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron" alt="Electron"/>
  <img src="https://img.shields.io/badge/Electron%20Forge-v7.9.0-blue?logo=electron" alt="Electron Forge"/>
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

`darkstar` is a powerful, client-side security tool designed to safeguard your Bitcoin wallet's recovery phrase (BIP39 mnemonic). It provides a robust, multi-layered solution for obfuscating and encrypting your seed phrase, adding a critical layer of security to protect your digital assets from both physical and digital threats. Available as both a web application and a cross-platform desktop application built with Electron.

## Features

- **AES-256 Encryption**: Industry-standard encryption to protect your data.
- **Multi-Layered Obfuscation**: A sophisticated, multi-stage process to secure your recovery phrase.
- **Cross-Platform Desktop App**: Available as a desktop application for Windows, macOS, and Linux, built with Electron.
  - **Frameless Window**: A modern, clean look without the default window frame.
  - **Custom Window Controls**: Custom-built window controls for minimizing, maximizing, and closing the application.
  - **Draggable Area**: The top navigation bar acts as a draggable area.
- **Client-Side Security**: All operations are performed client-side, ensuring your data never leaves your machine.
- **Auto-Updates**: Automatically checks for updates on startup. You can also manually check via the system tray menu.
- **Light & Dark Theme**: A user-friendly interface with both light and dark themes.

## Commands

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Kryklin/darkstar.git
    ```
2.  Install dependencies:
    ```bash
    cd darkstar
    npm install
    ```

### Web Application

To start the Angular development server:

```bash
npm start
```

The application will be available at `http://localhost:4200/`.

### Desktop Application (with Hot-Reloading)

To run the Electron application in development mode with hot-reloading for both the Angular frontend and the Electron main process:

```bash
npm run electron:dev
```

This command will:

1. Start the Angular development server.
2. Wait for the server to be ready on `http://localhost:4200`.
3. Launch the Electron application, which will load the content from the dev server.
4. Automatically restart the Electron app when you make changes to the Electron source files (`electron/main.ts`, `electron/preload.ts`).
5. Automatically reload the Electron window when you make changes to the Angular frontend code.

### Building

To create a distributable package for your current operating system:

```bash
npm run make
```

The packaged application will be located in the `out` folder.

### Testing

To run the unit tests using Karma and Jasmine:

```bash
npm test
```

This command opens a new browser window and runs all the `.spec.ts` files. The results are displayed in the terminal.

## How it Works

`darkstar` employs a sophisticated, multi-stage process to secure your recovery phrase:

1.  **Function Selection & Shuffling**: For each word in the mnemonic, Darkstar takes a curated pool of 12 obfuscation functions (6 seeded, 6 unseeded). It deterministically shuffles the order of these 12 functions based on the password and the word itself, creating a unique, unpredictable chain of operations for every word.
2.  **Password and Reverse Key Seeding**: The security model requires both the password and the reverse key for decryption. All 6 seeded functions (e.g., Vigenère Cipher, Character Shuffling) use a combined seed derived from both the password and a checksum of the shuffled function sequence. This ensures that the reverse key is not just a map, but an integral part of the decryption seed.
3.  **Multi-Layered Obfuscation**: The word is passed through the entire shuffled chain of 12 functions, applying complex, layered transformations.
4.  **AES-256 Encryption**: The final, heavily obfuscated words are joined together and then encrypted using the industry-standard AES-256 algorithm with the user-provided password.
5.  **Reverse Key Generation**: A "reverse key" is generated, containing the precise (and uniquely shuffled) sequence of obfuscation functions used for each word.
6.  **Key Encoding**: This reverse key is then Base64 encoded.

To decrypt, you need both the **Base64 encoded reverse key** (to reconstruct the shuffled function order and contribute to the seed) and your **password** (to decrypt the data and contribute to the seed). This dual-component, deeply integrated system provides a robust defense against attempts to compromise the recovery phrase.

## Authors

- **Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
