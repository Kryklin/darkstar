<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" alt="Darkstar Logo" width="400">
  </picture>
</p>

<h1 align="center">Darkstar</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/status-stable-green" alt="Status"/>
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

### Development

To start the application in development mode with hot-reloading for both web and desktop:
```bash
npm start
```

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

1.  **Guaranteed Seeded Obfuscation**: For each word, Darkstar randomly selects 12 unique obfuscation functions from a pool of 24. Crucially, it guarantees that at least one of these is a "seeded" function (e.g., character shuffling) that uses your password, deeply integrating the password into the obfuscation itself.
2.  **AES-256 Encryption**: The collection of obfuscated words is joined together and then encrypted using the industry-standard AES-256 algorithm with a user-provided password.
3.  **Reverse Key Generation**: A "reverse key" is generated, containing the precise sequence of obfuscation functions used for each word.
4.  **Key Encoding**: This reverse key is then Base64 encoded. This is the final key you need to store.

To decrypt, you need both the **Base64 encoded reverse key** (to reverse the obfuscation) and your **password** (to decrypt the data). This dual-component system significantly enhances the security of your recovery phrase.

## Technologies Used

- [Angular](https://angular.io/)
- [Angular Material](https://material.angular.io/)
- [Electron](https://www.electronjs.org/)
- [Electron Forge](https://www.electronforge.io/)
- [TypeScript](https://www.typescriptlang.org/)

## Authors

- **Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
