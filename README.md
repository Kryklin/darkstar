<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/icons/logo-white.png">
    <img src="public/assets/icons/logo-black.png" alt="Darkstar Logo" width="400">
  </picture>
</p>

<h1 align="center">Darkstar</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.1-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/Angular-v20.3.0-dd0031?logo=angular" alt="Angular"/>
  <img src="https://img.shields.io/badge/Angular%20Material-v20.2.3-blue?logo=angular" alt="Angular Material"/>
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

`darkstar` is a powerful, client-side security tool designed to safeguard your Bitcoin wallet's recovery phrase (BIP39 mnemonic). It provides a robust, multi-layered solution for obfuscating and encrypting your seed phrase, adding a critical layer of security to protect your digital assets from both physical and digital threats.

### How it Works

`darkstar` employs a sophisticated, multi-stage process to secure your recovery phrase:

1.  **Guaranteed Seeded Obfuscation**: For each word, Darkstar randomly selects 12 unique obfuscation functions from a pool of 24. Crucially, it guarantees that at least one of these is a "seeded" function (e.g., character shuffling) that uses your password, deeply integrating the password into the obfuscation itself.
2.  **AES-256 Encryption**: The collection of obfuscated words is joined together and then encrypted using the industry-standard AES-256 algorithm with a user-provided password.
3.  **Reverse Key Generation**: A "reverse key" is generated, containing the precise sequence of obfuscation functions used for each word.
4.  **Key Encoding**: This reverse key is then Base64 encoded. This is the final key you need to store.

To decrypt, you need both the **Base64 encoded reverse key** (to reverse the obfuscation) and your **password** (to decrypt the data). This dual-component system significantly enhances the security of your recovery phrase.

## Key Features

- **Angular**: A powerful and modern web application framework.
- **Angular Material**: A comprehensive library of UI components.
- **SCSS**: Advanced CSS preprocessor for more maintainable and powerful stylesheets.

## Authors

- **Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
