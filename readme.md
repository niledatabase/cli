# Nile CLI

Command line interface for managing Nile databases. Easily create, manage, and monitor your Nile databases from the terminal.

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

## Quick Start

1. **Authentication**

   You can authenticate using one of these methods:
   ```bash
   # Using API key directly
   nile --api-key YOUR_API_KEY db list

   # Or login via browser
   nile auth login
   ```

2. **Configure Workspace and Database**
   ```bash
   # List available workspaces
   nile workspace list

   # Set default workspace
   nile config --workspace demo

   # Set default database
   nile config --db mydb
   ```

3. **Manage Databases**
   ```bash
   # List all databases
   nile db list

   # List available regions
   nile db regions

   # Create a new database
   nile db create --name mydb --region AWS_US_WEST_2

   # Show database details
   nile db show mydb

   # Get database connection string
   nile db connectionstring --name mydb --psql          # Get PostgreSQL connection string

   # Delete a database
   nile db delete mydb

   # Connect to database using psql (requires PostgreSQL client tools)
   nile db psql --name mydb
   ```

## Configuration

The CLI supports multiple ways to configure settings, with the following priority order (highest to lowest):

1. Command line flags
   ```bash
   nile --workspace demo --db mydb tenants list
   ```

2. Configuration file (via `nile config`)
   ```bash
   nile config --workspace demo --db mydb --api-key YOUR_API_KEY
   ```

3. Environment variables
   ```bash
   export NILE_WORKSPACE=demo
   export NILE_DB=mydb
   export NILE_API_KEY=YOUR_API_KEY
   ```

## Global Options

- `--api-key <key>`: API key for authentication
- `--workspace <name>`: Workspace to use
- `--db <name>`: Database to use
- `-f, --format <type>`: Output format: human (default), json, or csv
- `--color`: Enable colored output (default: true)
- `--no-color`: Disable colored output
- `--debug`: Enable debug output
- `-h, --help`: Show help information

## Commands

### Authentication
```bash
nile auth login    # Login using browser-based auth
nile auth status   # Check authentication status
nile auth logout   # Clear stored credentials
```

### Configuration
```bash
# View current configuration
nile config

# Set configuration values
nile config --workspace demo --db mydb
nile config --api-key YOUR_API_KEY
```

### Workspaces
```bash
nile workspace list           # List available workspaces
nile workspace show          # Show current workspace
```

### Databases
```bash
# List databases
nile db list

# List available regions
nile db regions

# Create database
nile db create --name mydb --region AWS_US_WEST_2

# Show database details
nile db show mydb

# Get database connection string
nile db connectionstring --name mydb --psql          # Get PostgreSQL connection string

# Delete a database
nile db delete mydb

# Connect to database using psql (requires PostgreSQL client tools)
nile db psql --name mydb
```

### Tenants
```bash
# List all tenants
nile tenants list

# Create a new tenant
nile tenants create --name "My Tenant"              # Create with auto-generated ID
nile tenants create --name "My Tenant" --id custom-id   # Create with custom ID

# Update a tenant
nile tenants update --id tenant-123 --new_name "New Name"   # Update tenant name

# Delete a tenant
nile tenants delete --id tenant-123                 # Delete by ID

# List tenants in specific workspace/database
nile tenants list --workspace myworkspace --db mydb
```

## Output Formats

The CLI supports multiple output formats for easy integration with other tools:

1. **Human-readable** (default):
   ```bash
   nile db list
   ```

2. **JSON** (good for scripting):
   ```bash
   nile --format json db list
   ```

3. **CSV** (good for spreadsheets):
   ```bash
   nile --format csv db list
   ```

## Debugging

For troubleshooting, use the `--debug` flag to see detailed API interactions:
```bash
nile --debug db list
```

## Environment Variables

- `NILE_API_KEY`: API key for authentication
- `NILE_WORKSPACE`: Default workspace
- `NILE_DB`: Default database
- `NILE_DB_HOST`: Custom database host (optional)
- `NILE_GLOBAL_HOST`: Custom global host (optional)

## Common Use Cases

1. **Setting Up Your Environment**
   ```bash
   # Set your configuration
   nile config --workspace demo --db mydb --api-key YOUR_API_KEY

   # Verify configuration
   nile config
   ```

2. **Creating a Database**
   ```bash
   # List available regions
   nile db regions
   
   # Create in specific region
   nile db create --name mydb --region AWS_US_WEST_2
   ```

3. **Getting Connection Details**
   ```bash
   # Get PostgreSQL connection string
   nile db connectionstring --name mydb --psql
   postgres://01947d5b-ba0a-7bdd-9770-788de783cd61:your-password@us-west-2.db.thenile.dev:5432/mydb
   ```

4. **Managing Tenants**
   ```bash
   # Create a new tenant
   nile tenants create --name "Acme Corp"

   # Create tenant with specific ID
   nile tenants create --name "Acme Corp" --id acme-123

   # List all tenants
   nile tenants list

   # Update tenant name
   nile tenants update --id acme-123 --new_name "Acme Corporation"

   # Delete tenant
   nile tenants delete --id acme-123
   ```

5. **Automation Scripts**
   ```bash
   # Use JSON output and no colors
   nile --format json --no-color db list
   
   # Force delete without confirmation
   nile db delete mydb --force
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT