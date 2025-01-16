# Nile CLI

A command-line interface for managing Nile databases and workspaces.

## Installation

```bash
npm install -g @niledatabase/cli
```

## Quick Start

1. Login to your Nile account:
   ```bash
   nile connect login
   ```

2. Select a workspace:
   ```bash
   nile workspace select <workspace-name>
   ```

3. Create a database:
   ```bash
   nile db create --name my-db --region us-west-1
   ```

## Command Reference

### `nile connect` - Authentication Management

#### Login
```bash
nile connect login
```
Opens a web browser for authentication. After successful login, your CLI session will be authenticated.

**Example Output:**
```
Opening browser for authentication...
Authentication successful! You are now logged in as user@example.com.
```

#### Logout
```bash
nile connect logout
```
Ends the current authenticated session.

**Example Output:**
```
You have been logged out.
```

### `nile workspace` - Workspace Management

#### Select Workspace
```bash
nile workspace select <workspaceName>
```
Sets the active workspace context for subsequent commands.

**Example Output:**
```
Workspace switched to 'engineering-team'.
```

#### List Workspaces
```bash
nile workspace list
```
Displays all accessible workspaces.

**Example Output:**
```
Available Workspaces:
- engineering-team
- product-team
- finance
```

#### Show Current Workspace
```bash
nile workspace show
```
Displays the currently active workspace.

**Example Output:**
```
Current workspace: engineering-team
```

### `nile db` - Database Management

#### List Databases
```bash
nile db list
```
Shows all databases in the current workspace.

**Example Output:**
```
Databases in workspace 'engineering-team':
NAME           REGION       STATUS
analytics-db   us-west-1    running
test-db        us-east-1    stopped
```

#### Create Database
```bash
nile db create --name <databaseName> --region <region>
```
Creates a new database in the selected workspace.

**Example Output:**
```
Creating database 'prod-db' in region 'us-west-1'...
Database 'prod-db' created successfully.
```

#### Delete Database
```bash
nile db delete <databaseName>
```
Deletes a specified database (requires confirmation).

**Example Output:**
```
Are you sure you want to delete 'prod-db'? This action cannot be undone. (yes/no): yes
Deleting database 'prod-db'...
Database 'prod-db' deleted successfully.
```

### `nile psql` - Database Connection

```bash
nile psql --connection-string <connectionString> --db <databaseName>
```
Connects to a Nile database using PostgreSQL's psql tool.

**Example Output:**
```
Connecting to database 'prod-db'...
psql (14.0)
Type "help" for help.

prod-db=>
```

## Global Flags

The following flags can be used with any command:

- `-api-token <token>`: Specify API token for authentication
- `-api-url <url>`: Override the base Nile API URL
- `-config <path>`: Use custom config file (default: `$HOME/.config/niledb/nile.yml`)
- `-debug`: Enable debug mode for detailed logging
- `-f, --format <type>`: Set output format (`human`, `json`, `csv`)
- `-h, --help`: Show command help
- `-no-color`: Disable colored output
- `-version`: Show CLI version

### Format Flag Example
```bash
nile workspace list --format json
```

**Output:**
```json
[
  { "name": "engineering-team", "id": "12345" },
  { "name": "product-team", "id": "67890" }
]
```

### Help Flag Example
```bash
nile workspace --help
```

**Output:**
```
Usage: nile workspace [options] [command]
Manage workspaces in Nile.

Commands:
  select <workspaceName>  Select a workspace
  list                    List available workspaces
  show                    Show the currently selected workspace
```

## Support

For issues and feature requests, please visit our [GitHub repository](https://github.com/niledatabase/nile-cli).

## License

MIT
