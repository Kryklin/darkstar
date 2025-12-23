<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" alt="Darkstar Logo" width="400">
  </picture>
</p>

<h1 align="center">Contributing to Darkstar</h1>

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Darkstar. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Darkstar. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps to reproduce the problem** in as many details as possible.
- **Include screenshots and animated GIFs** which show you following the described steps and demonstrate the problem.
- **Explain which behavior you expected to see instead and why.**

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Darkstar, including completely new features and minor improvements to existing functionality.

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps.**

### Pull Requests

1.  Fork the repo and create your branch from `main`.
2.  If you've added code that should be tested, add tests.
3.  If you've changed APIs, update the documentation.
4.  Ensure the test suite passes.
5.  Make sure your code lints.
6.  Issue that pull request!

## Development Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run in development mode (Angular + Electron)**:
    ```bash
    npm run electron:dev
    ```

3.  **Linting**:
    ```bash
    npm run lint
    ```

4.  **Formatting**:
    ```bash
    npx prettier --write .
    ```

## Styleguides

### Git Commit Messages

*   Use the present tense ("Add feature" not "Added feature")
*   Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
*   Limit the first line to 72 characters or less
*   Reference issues and pull requests liberally after the first line

### Coding Standards

*   We use **Prettier** for formatting.
*   We use **ESLint** for linting.
*   Please ensure `npm run lint` passes before submitting.
