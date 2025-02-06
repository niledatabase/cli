# Contributing to Nile CLI

We love your input! We want to make contributing to Nile CLI as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Branch Strategy

1. `main` - Production branch, contains the latest stable release
2. `alpha` - Pre-release branch, contains features ready for testing
3. Feature branches - Created from `alpha` for individual features/fixes

### Development Workflow

1. **Start Development**
   - Create a new branch from `alpha` for your feature
   ```bash
   git checkout alpha
   git pull origin alpha
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write your code
   - Add tests if applicable
   - Ensure tests pass: `npm test`
   - Ensure linting passes: `npm run lint`

3. **Commit Changes**
   - Follow [Conventional Commits](https://www.conventionalcommits.org/) specification
   ```bash
   feat: add new feature
   fix: resolve specific issue
   docs: update documentation
   ```

4. **Create Pull Request**
   - Push your branch to GitHub
   - Create a Pull Request to the `alpha` branch
   - Fill out the PR template
   - Request review from maintainers

5. **Release Process**
   - Merges to `alpha` trigger automatic pre-releases
   - Pre-releases are published to npm with the `alpha` tag
   - When ready for production, `alpha` is merged to `main`
   - After main release, `alpha` version is automatically incremented

### Installing Development Dependencies

```bash
# Clone the repository
git clone https://github.com/niledatabase/cli.git
cd cli

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the package.json version if needed
3. The PR must be approved by at least one maintainer
4. PR title must follow conventional commits specification

## Any contributions you make will be under the MIT Software License
In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/niledatabase/cli/issues)
We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/niledatabase/cli/issues/new).

### Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Use a Consistent Coding Style

* Use TypeScript for all new code
* 2 spaces for indentation
* Run `npm run lint` to ensure style compliance

## License
By contributing, you agree that your contributions will be licensed under its MIT License. 