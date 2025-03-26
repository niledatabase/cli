<p align="center">
 <a href="https://thenile.dev" target="_blank"><img width="96px" src="https://www.thenile.dev/about-logo.png" /></a>
 <h2 align="center">Nile CLI
  <br/>
  <img src="https://img.shields.io/npm/v/@niledatabase/server"/>
 </h2>
 <p align="center">
  <a href="https://thenile.dev/docs/cli"><strong>Learn more ↗️</strong></a>
  <br />
  <br />
  <a href="https://discord.gg/akRKRPKA">Discord</a>
  🔵
  <a href="https://thenile.dev">Website</a>
  🔵 
  <a href="https://github.com/orgs/niledatabase/discussions">Issues</a>
 </p>
</p>

# Nile CLI

Command line interface for managing Nile databases. Easily create, manage, and monitor your Nile databases from the terminal.

For detailed documentation, visit our [CLI Documentation](https://thenile.dev/docs/cli/introduction).

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
# Show help and version
nile --help
nile --version

# Authentication
nile connect login          # Login using browser-based authentication
nile connect status        # Check connection status
nile connect logout       # Clear stored credentials

# Authentication Setup
nile auth quickstart --nextjs  # Set up authentication in a Next.js app
nile auth env                  # Generate environment variables
nile auth env --output .env.local  # Save environment variables to file

# Workspace Management
nile workspace list       # List all workspaces
nile workspace show      # Show current workspace details
nile config --workspace <name>  # Set default workspace

# Database Management
nile db list            # List all databases
nile db show <name>     # Show database details
nile db create --name <name> --region <region>  # Create a new database
nile db delete <name>   # Delete a database
nile db psql           # Connect using PostgreSQL CLI
nile db connectionstring --psql  # Get PostgreSQL connection string
nile db regions        # List available regions

# Tenant Management
nile tenants list                                    # List all tenants
nile tenants create --name "Name"                    # Create a tenant
nile tenants create --name "Name" --id custom-id     # Create tenant with custom ID
nile tenants update --id <id> --new_name "Name"      # Update tenant
nile tenants delete --id <id>                        # Delete tenant

# User Management
nile users create --email "user@example.com" --password "password123"  # Create a new user
nile users create --email "user@example.com" --password "pass123" --tenant tenant-123  # Create user in tenant
nile users list                                                        # List all users
nile users update --id user-123 --new_email "new@example.com"         # Update user email
nile users delete --id user-123                                        # Delete user

# Local Development
nile local start      # Start local development environment
nile local stop       # Stop local environment
nile local info       # Show connection information

# Configuration
nile config                          # Show current configuration
nile config --api-key <key>         # Set API key
nile config --workspace <name>       # Set workspace
nile config --db <name>             # Set database
nile config reset                   # Reset configuration
```

### Global Options

These options work with all commands:

```bash
--api-key <key>      # API key for authentication
--workspace <name>   # Workspace to use
--db <name>         # Database to use
--format <type>     # Output format: human (default), json, or csv
--color            # Enable colored output (default: true)
--no-color         # Disable colored output
--debug            # Enable debug output
```

### Output Formats

```bash
# Human-readable (default)
nile db list

# JSON format
nile --format json db list

# CSV format
nile --format csv db list
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
- `--workspace <name>`: Workspace to use
- `--db <name>`: Database to use
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
