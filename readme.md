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

2. **Select a Workspace**
   ```bash
   nile workspace list          # List available workspaces
   nile workspace select demo   # Select a workspace
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
   nile db connectionstring --name mydb                 # Get connection details in JSON format
   nile db connectionstring --name mydb --psql          # Get PostgreSQL connection string

   # Delete a database
   nile db delete mydb

   # Connect to database using psql (requires PostgreSQL client tools)
   nile db psql --name mydb                    # Creates new credentials and connects
   nile db psql --name mydb --connection-string "postgres://..."   # Uses provided connection string
   ```

## Global Options

- `--api-key <key>`: API key for authentication (can also be set via NILE_API_KEY env variable)
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

### Workspaces
```bash
nile workspace list           # List available workspaces
nile workspace select demo    # Select a workspace
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
nile db connectionstring --name mydb                 # Get connection details in JSON format
nile db connectionstring --name mydb --psql          # Get PostgreSQL connection string

# Delete a database
nile db delete mydb

# Connect to database using psql (requires PostgreSQL client tools)
nile db psql --name mydb                    # Creates new credentials and connects
nile db psql --name mydb --connection-string "postgres://..."   # Uses provided connection string
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

- `NILE_API_KEY`: Set your API key without passing it in the command line

## Common Use Cases

1. **Creating a Database**
   ```bash
   # List available regions
   nile db regions
   
   # Create in specific region
   nile db create --name mydb --region AWS_US_WEST_2
   ```

2. **Getting Connection Details**
   ```bash
   # Get connection details in JSON format
   nile db connectionstring --name mydb
   {
     "host": "us-west-2.db.thenile.dev",
     "port": 5432,
     "database": "mydb",
     "username": "01947d5b-ba0a-7bdd-9770-788de783cd61",
     "password": "your-password"
   }

   # Get PostgreSQL connection string
   nile db connectionstring --name mydb --psql
   postgres://01947d5b-ba0a-7bdd-9770-788de783cd61:your-password@us-west-2.db.thenile.dev:5432/mydb
   ```

3. **Automation Scripts**
   ```bash
   # Use JSON output and no colors
   nile --format json --no-color db list
   
   # Force delete without confirmation
   nile db delete mydb --force
   ```

4. **Checking Database Status**
   ```bash
   # Get detailed database info
   nile db show mydb
   ```

5. **Connecting to Databases**
   ```bash
   # First ensure PostgreSQL client tools are installed:
   # - On macOS: brew install postgresql
   # - On Ubuntu/Debian: apt-get install postgresql-client
   # - On Windows: Install from https://www.postgresql.org/download/windows/
   
   # Then connect to your database
   nile db psql --name mydb
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT