# Cross-Platform Development Scripts Summary

This document summarizes the cross-platform development improvements made to support Windows, macOS, and Linux development environments.

## Files Added/Modified

### New Development Scripts

1. **`scripts/dev.cmd`** - Windows Batch script
   - Native Windows batch file for Command Prompt
   - Handles Windows-specific path separators and commands
   - Opens services in separate command windows for the `all` command

2. **`scripts/dev.ps1`** - Windows PowerShell script (Recommended)
   - Modern PowerShell script with better error handling
   - Colored output and enhanced functionality
   - Opens services in separate PowerShell windows for the `all` command

3. **`scripts/dev-unified.sh`** - Universal cross-platform script
   - Enhanced Bash script with comprehensive OS detection
   - Supports Unix, Linux, macOS, Windows (Git Bash), WSL, MSYS2, Cygwin
   - Intelligent platform-specific behavior adaptation
   - Fallback mechanisms for different environments

4. **`scripts/README.md`** - Comprehensive documentation
   - Usage instructions for all platforms
   - Platform-specific notes and troubleshooting
   - Installation requirements and prerequisites

### Modified Files

5. **`scripts/dev.sh`** - Enhanced original script
   - Added OS detection (`linux`, `macos`, `windows`)
   - Improved Windows support in tmux alternatives
   - Better error messages and user guidance

6. **`DEVELOPMENT.md`** - Updated development guide
   - Added platform-specific script instructions
   - Included Windows PowerShell and Command Prompt examples
   - Added platform-specific notes and troubleshooting

### New GitHub Workflow

7. **`.github/workflows/test-dev-scripts.yaml`** - CI/CD testing
   - Tests all development scripts across platforms
   - Validates functionality on Ubuntu, Windows, and macOS
   - Tests both PowerShell and Command Prompt on Windows

## Platform Support Matrix

| Platform | Script | Shell | Status | Notes |
|----------|--------|-------|---------|--------|
| **Linux** | `dev.sh` | bash | ✅ Full | Uses tmux for `all` command |
| **macOS** | `dev.sh` | bash | ✅ Full | Uses tmux for `all` command |
| **Windows** | `dev.ps1` | PowerShell | ✅ Full | **Recommended** - Opens separate windows |
| **Windows** | `dev.cmd` | cmd | ✅ Basic | Opens separate windows |
| **Git Bash** | `dev-unified.sh` | bash | ✅ Full | Enhanced Windows compatibility |
| **WSL** | `dev-unified.sh` | bash | ✅ Full | Auto-detects WSL environment |
| **MSYS2** | `dev-unified.sh` | bash | ✅ Full | Windows-native paths |
| **Cygwin** | `dev-unified.sh` | bash | ✅ Basic | Limited testing |

## Key Features

### Cross-Platform Compatibility
- **Path Handling**: Automatic Windows/Unix path conversion
- **Command Adaptation**: Platform-specific command variations
- **Shell Detection**: Bash, Zsh, PowerShell, Command Prompt support
- **Environment Detection**: WSL, MSYS2, Cygwin recognition

### Service Management
- **Unix/Linux/macOS**: tmux sessions with fallback to parallel processes
- **Windows**: Separate windows for each service (PowerShell/cmd)
- **Git Bash/WSL**: Intelligent adaptation based on environment

### Developer Experience
- **Consistent Commands**: Same command syntax across all platforms
- **Colored Output**: Platform-appropriate colored terminal output
- **Error Handling**: Clear error messages and troubleshooting guidance
- **Dependency Checking**: Validates Go, Node.js, npm availability

## Usage Examples

### Windows PowerShell (Recommended)
```powershell
# Setup project
.\scripts\dev.ps1 setup

# Run all services
.\scripts\dev.ps1 all

# Run individual service
.\scripts\dev.ps1 backend
```

### Windows Command Prompt
```cmd
scripts\dev.cmd setup
scripts\dev.cmd all
scripts\dev.cmd backend
```

### Unix/Linux/macOS
```bash
./scripts/dev.sh setup
./scripts/dev.sh all
./scripts/dev.sh backend
```

### Git Bash/WSL/MSYS2
```bash
./scripts/dev-unified.sh setup
./scripts/dev-unified.sh all
./scripts/dev-unified.sh backend
```

## GitHub Actions Integration

The existing release workflow already had excellent cross-platform support:
- ✅ **Linux builds**: Alpine container with static linking
- ✅ **Windows builds**: Native Windows runners with proper PowerShell
- ✅ **macOS builds**: Both Intel (amd64) and Apple Silicon (arm64)

### New Workflow Added
- **`test-dev-scripts.yaml`**: Tests development scripts across all platforms
- Validates script functionality before merging changes
- Ensures consistent behavior across Windows, macOS, and Linux

## Troubleshooting

### Windows Issues
1. **PowerShell Execution Policy**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
2. **Path Issues**: Use PowerShell script instead of batch file
3. **Missing Dependencies**: Ensure Go, Node.js, npm are in PATH

### Unix Issues
1. **tmux Not Found**: Install tmux or services will run in parallel processes
2. **Permission Denied**: Run `chmod +x scripts/dev.sh`
3. **Path Issues**: Ensure script is run from project root

### Cross-Platform Issues
1. **Git Bash**: Use `dev-unified.sh` for better Windows compatibility
2. **WSL**: Automatically detected and handled by unified script
3. **MSYS2**: Use unified script for proper path handling

## Benefits

1. **Developer Onboarding**: New developers can start regardless of platform
2. **Team Consistency**: Same workflow across different development environments
3. **CI/CD Confidence**: Scripts tested in automation prevent deployment issues
4. **Maintenance Efficiency**: Single command set for all platforms
5. **Future-Proof**: Easy to extend for new platforms or requirements

## Future Enhancements

- **Docker Integration**: Add containerized development option
- **IDE Integration**: VS Code tasks for script integration
- **Progress Indicators**: Enhanced visual feedback during setup
- **Configuration Validation**: Pre-flight checks for environment setup
- **Hot Reload**: File watching for automatic service restarts