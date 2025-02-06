# Nile CLI

Command line interface for managing Nile databases. Easily create, manage, and monitor your Nile databases from the terminal.

## Installation

### Using npm

```bash
# Install latest stable version
npm install -g niledatabase

# Install latest alpha version (for testing)
npm install -g niledatabase@alpha
```

### Using yarn

```bash
# Install latest stable version
yarn global add niledatabase

# Install latest alpha version (for testing)
yarn global add niledatabase@alpha
```

### Using bun

```bash
# Install latest stable version
bun install -g niledatabase

# Install latest alpha version (for testing)
bun install -g niledatabase@alpha
```

### Platform-specific Notes

<details>
  <summary><b>macOS</b></summary>

The CLI should work out of the box on macOS. If you encounter permission issues:

```bash
# Using npm
sudo npm install -g niledatabase

# Using yarn
sudo yarn global add niledatabase

# Using bun
sudo bun install -g niledatabase
```
</details>

<details>
  <summary><b>Linux</b></summary>

On Linux systems, you might need to add the npm global bin directory to your PATH if it's not already there:

```bash
# Add this to your ~/.bashrc or ~/.zshrc
export PATH="$PATH:$(npm config get prefix)/bin"

# Then reload your shell
source ~/.bashrc  # or source ~/.zshrc
```
</details>

## Verifying Installation

After installation, verify that the CLI is properly installed:

```bash
nile --version
```

## Usage

```bash
# Show help
nile --help

# List available commands
nile help

# Configure your workspace
nile config --workspace <workspace-name>

# List databases
nile db list

# Create a new database
nile db create --name <db-name> --region <region>
```

## Development Versions

If you want to try out the latest features before they're released:

1. Alpha versions are published when changes are merged to the main branch
2. Stable versions are published when changes are merged to the stable branch

To install a specific version:

```bash
npm install -g niledatabase@<version>
```

## Troubleshooting

If you encounter permission errors during installation:

1. **Recommended approach** - Fix npm permission:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

2. **Alternative approach** - Use sudo (not recommended):
   ```bash
   sudo npm install -g niledatabase
   ```

For other issues, please check our [issues page](https://github.com/niledatabase/cli-latest/issues).

## Building from Source

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Git
- PostgreSQL command line tools (psql) - required for database connections

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/niledatabase/nile-cli.git
   cd nile-cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the CLI:
   ```bash
   npm run build
   ```

4. Link the CLI globally:
   ```bash
   npm link
   ```

Now you can use the `nile` command from anywhere in your terminal.

## Connecting to Nile

There are three ways to connect to Nile:

1. **Browser-based Authentication** (Recommended)
   ```bash
   # Start the authentication flow
   nile connect login
   
   # Check connection status
   nile connect status
   
   # Logout when needed
   nile connect logout
   ```

2. **Using API Key**
   ```bash
   # Use API key directly in commands
   nile --api-key YOUR_API_KEY db list
   
   # Or save it in configuration
   nile config --api-key YOUR_API_KEY
   ```

3. **Environment Variables**
   ```bash
   export NILE_API_KEY=YOUR_API_KEY
   ```

## Configuration Management

The CLI supports multiple ways to configure settings, with the following priority (highest to lowest):

1. Command line flags
2. Configuration file (via `nile config`)
3. Environment variables

### Using the Config Command

```bash
# View current configuration
nile config

# Set workspace and database
nile config --workspace demo --db mydb

# Set API key
nile config --api-key YOUR_API_KEY

# Reset configuration
nile config reset
```

### Environment Variables

- `NILE_API_KEY`: API key for authentication
- `NILE_WORKSPACE`: Default workspace
- `NILE_DB`: Default database
- `NILE_DB_HOST`: Custom database host (optional)
- `NILE_GLOBAL_HOST`: Custom global host (optional)

## Workspace Management

Workspaces help organize your databases and resources. Here's how to manage them:

```bash
# List all available workspaces
nile workspace list

# Show current workspace details
nile workspace show

# Set default workspace
nile config --workspace demo
```

## Database Management

### Listing and Creating Databases

```bash
# List all databases in current workspace
nile db list

# Show specific database details
nile db show mydb

# List available regions
nile db create --region  # Lists regions if no region specified

# Create a new database
nile db create --name mydb --region AWS_US_WEST_2
```

### Connecting to Databases

```bash
# Connect using psql (requires PostgreSQL client tools)
nile db psql --name mydb

# Get connection string
nile db connectionstring --name mydb

# Delete a database (use --force to skip confirmation)
nile db delete mydb
```

## Tenant Management

Nile provides built-in multi-tenancy support. Here's how to manage tenants:

```bash
# List all tenants
nile tenants list

# Create a tenant
nile tenants create --name "My Tenant"                    # Auto-generated ID
nile tenants create --name "My Tenant" --id custom-id     # Custom ID

# Update tenant name
nile tenants update --id tenant-123 --new_name "New Name"

# Delete a tenant
nile tenants delete --id tenant-123
```

## Global Options

These options work with all commands:

- `--api-key <key>`: API key for authentication
- `--workspace <n>`: Workspace to use
- `--db <n>`: Database to use
- `-f, --format <type>`: Output format: human (default), json, or csv
- `--color`: Enable colored output (default: true)
- `--no-color`: Disable colored output
- `--debug`: Enable debug output
- `-h, --help`: Show help information

## Output Formats

The CLI supports multiple output formats for easy integration:

```bash
# Human-readable (default)
nile db list

# JSON format
nile --format json db list

# CSV format
nile --format csv db list
```

## Debugging

For troubleshooting:

```bash
# Enable debug output
nile --debug db list

# Check connection status
nile connect status
```

## Common Workflows

1. **Initial Setup**
   ```bash
   # Connect to Nile
   nile connect
   
   # Set default workspace and database
   nile config --workspace demo --db mydb
   
   # Verify configuration
   nile config
   ```

2. **Database Creation and Connection**
   ```bash
   # Create database
   nile db create --name mydb --region AWS_US_WEST_2
   
   # Connect using psql
   nile db psql --name mydb
   ```

3. **Tenant Management**
   ```bash
   # Create tenant
   nile tenants create --name "Customer A"
   
   # List all tenants
   nile tenants list
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT
