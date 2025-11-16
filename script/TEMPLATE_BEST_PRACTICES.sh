#!/usr/bin/env bash
#
# File: TEMPLATE_BEST_PRACTICES.sh
# Description: Template demonstrating world-class bash scripting best practices
# Author: Net Storm
# Date: 2025-11-15
# Version: 1.0.0
#
# Based on:
#   - Google Shell Style Guide (https://google.github.io/styleguide/shellguide.html)
#   - OWASP Security Standards 2025
#   - MIT Safe Shell Guidelines
#   - ShellCheck recommendations
#
# Dependencies:
#   - bash 4.0+
#   - coreutils
#
# Usage:
#   ./TEMPLATE_BEST_PRACTICES.sh [OPTIONS]
#
# Options:
#   -h, --help          Show this help message
#   -v, --verbose       Enable verbose output
#   -d, --debug         Enable debug mode
#   -c, --config FILE   Configuration file path
#
# Environment Variables:
#   LOG_LEVEL    - Logging level (DEBUG|INFO|WARN|ERROR) [default: INFO]
#   CONFIG_DIR   - Configuration directory [default: ./config]
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Configuration error
#   3 - Permission error
#   4 - Dependency missing
#

###############################################################################
# BEST PRACTICE #1: Strict Mode (Google + MIT)
###############################################################################
set -euo pipefail
IFS=$'\n\t'

###############################################################################
# BEST PRACTICE #2: Constants & Configuration
###############################################################################

# Script metadata
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_VERSION="1.0.0"

# Default configuration
readonly DEFAULT_CONFIG_DIR="${CONFIG_DIR:-./config}"
readonly DEFAULT_LOG_LEVEL="${LOG_LEVEL:-INFO}"
readonly DEFAULT_LOG_FILE="${SCRIPT_DIR}/../log/${SCRIPT_NAME%.*}.log"

# Colors for output (ANSI)
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Global variables (use sparingly, prefer local)
declare -a TEMP_FILES=()
declare -a CLEANUP_PIDS=()

###############################################################################
# BEST PRACTICE #3: Logging Functions (MIT + Linux Foundation)
###############################################################################

#######################################
# Print colored message to stderr
# Globals:
#   RED, GREEN, YELLOW, BLUE, NC
# Arguments:
#   $1 - Color code
#   $2 - Message
# Returns:
#   None
#######################################
print_color() {
    local color="$1"
    local message="$2"
    echo -e "${color}${message}${NC}" >&2
}

#######################################
# Log message with timestamp and level
# Globals:
#   DEFAULT_LOG_FILE
#   DEFAULT_LOG_LEVEL
# Arguments:
#   $1 - Log level (DEBUG|INFO|WARN|ERROR)
#   $2 - Message
# Returns:
#   None
#######################################
log_message() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    local color="$NC"
    case "$level" in
        DEBUG)   color="$CYAN" ;;
        INFO)    color="$GREEN" ;;
        WARN)    color="$YELLOW" ;;
        ERROR)   color="$RED" ;;
    esac

    # Log to file and stderr
    local log_entry="[${timestamp}] [${level}] ${message}"
    echo "$log_entry" >> "$DEFAULT_LOG_FILE"
    print_color "$color" "$log_entry"
}

#######################################
# Convenience logging functions
#######################################
log_debug() { log_message "DEBUG" "$1"; }
log_info()  { log_message "INFO" "$1"; }
log_warn()  { log_message "WARN" "$1"; }
log_error() { log_message "ERROR" "$1"; }

###############################################################################
# BEST PRACTICE #4: Input Validation (OWASP)
###############################################################################

#######################################
# Validate string against regex pattern
# Arguments:
#   $1 - Input string
#   $2 - Regex pattern
#   $3 - Error message (optional)
# Returns:
#   0 on success, 1 on failure
#######################################
validate_input() {
    local input="$1"
    local pattern="$2"
    local error_msg="${3:-Invalid input}"

    if [[ ! "$input" =~ $pattern ]]; then
        log_error "$error_msg: '$input'"
        return 1
    fi

    return 0
}

#######################################
# Validate file path (prevent directory traversal)
# Arguments:
#   $1 - File path
# Returns:
#   0 on success, 1 on failure
#######################################
validate_path() {
    local filepath="$1"

    # Check for directory traversal attempts
    if [[ "$filepath" =~ \.\. ]]; then
        log_error "Directory traversal attempt detected: $filepath"
        return 1
    fi

    # Check if path is absolute (optional)
    if [[ ! "$filepath" =~ ^/ ]]; then
        log_warn "Relative path detected: $filepath"
    fi

    return 0
}

#######################################
# Sanitize integer input
# Arguments:
#   $1 - Input value
#   $2 - Minimum value
#   $3 - Maximum value
#   $4 - Default value
# Returns:
#   Sanitized integer
#######################################
sanitize_integer() {
    local value="$1"
    local min="$2"
    local max="$3"
    local default="$4"

    # Check if numeric
    if [[ ! "$value" =~ ^[0-9]+$ ]]; then
        echo "$default"
        return
    fi

    # Clamp to range
    if (( value < min )); then
        echo "$min"
    elif (( value > max )); then
        echo "$max"
    else
        echo "$value"
    fi
}

###############################################################################
# BEST PRACTICE #5: Error Handling & Cleanup (MIT)
###############################################################################

#######################################
# Cleanup function called on exit
# Globals:
#   TEMP_FILES
#   CLEANUP_PIDS
# Arguments:
#   $1 - Exit code
# Returns:
#   None
#######################################
cleanup() {
    local exit_code="${1:-0}"

    log_info "Cleaning up (exit code: $exit_code)..."

    # Remove temporary files
    for file in "${TEMP_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            rm -f "$file"
            log_debug "Removed temp file: $file"
        fi
    done

    # Kill background processes
    for pid in "${CLEANUP_PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            log_debug "Killed background process: $pid"
        fi
    done

    log_info "Cleanup complete"
    exit "$exit_code"
}

# Setup trap for cleanup
trap 'cleanup $?' EXIT
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

###############################################################################
# BEST PRACTICE #6: Dependency Checking
###############################################################################

#######################################
# Check if command exists
# Arguments:
#   $1 - Command name
# Returns:
#   0 if exists, 1 otherwise
#######################################
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

#######################################
# Check required dependencies
# Arguments:
#   $@ - List of required commands
# Returns:
#   0 on success, exits on failure
#######################################
check_dependencies() {
    local missing=()

    for cmd in "$@"; do
        if ! command_exists "$cmd"; then
            missing+=("$cmd")
        fi
    done

    if (( ${#missing[@]} > 0 )); then
        log_error "Missing required dependencies: ${missing[*]}"
        log_error "Please install missing dependencies and try again"
        exit 4
    fi

    log_debug "All dependencies satisfied"
}

###############################################################################
# BEST PRACTICE #7: Configuration Management
###############################################################################

#######################################
# Load configuration from file
# Globals:
#   Sets various config variables
# Arguments:
#   $1 - Config file path
# Returns:
#   0 on success, 2 on error
#######################################
load_config() {
    local config_file="$1"

    if [[ ! -f "$config_file" ]]; then
        log_error "Config file not found: $config_file"
        return 2
    fi

    # Validate config file permissions (should not be world-writable)
    if [[ -w "$config_file" ]] && [[ "$(stat -c '%a' "$config_file")" =~ [0-9][0-9][2-7] ]]; then
        log_warn "Config file is world-writable: $config_file"
    fi

    # Source config file (safely)
    # shellcheck source=/dev/null
    if ! source "$config_file"; then
        log_error "Failed to load config file: $config_file"
        return 2
    fi

    log_info "Configuration loaded from: $config_file"
    return 0
}

###############################################################################
# BEST PRACTICE #8: Argument Parsing
###############################################################################

#######################################
# Display usage information
# Returns:
#   None
#######################################
usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Template demonstrating world-class bash scripting best practices

Options:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -d, --debug         Enable debug mode
    -c, --config FILE   Configuration file path
    --version           Show version information

Environment Variables:
    LOG_LEVEL    - Logging level (DEBUG|INFO|WARN|ERROR) [default: INFO]
    CONFIG_DIR   - Configuration directory [default: ./config]

Examples:
    $SCRIPT_NAME --verbose
    $SCRIPT_NAME --config /path/to/config.conf
    LOG_LEVEL=DEBUG $SCRIPT_NAME

Exit Codes:
    0 - Success
    1 - General error
    2 - Configuration error
    3 - Permission error
    4 - Dependency missing

For more information, see the project documentation.
EOF
}

#######################################
# Parse command line arguments
# Globals:
#   Sets various option variables
# Arguments:
#   $@ - Command line arguments
# Returns:
#   0 on success, 1 on error
#######################################
parse_arguments() {
    local config_file=""
    local verbose=false
    local debug=false

    while (( $# > 0 )); do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -d|--debug)
                debug=true
                set -x  # Enable trace
                shift
                ;;
            -c|--config)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option --config requires an argument"
                    return 1
                fi
                config_file="$2"
                shift 2
                ;;
            --version)
                echo "$SCRIPT_NAME version $SCRIPT_VERSION"
                exit 0
                ;;
            --)
                shift
                break
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                return 1
                ;;
            *)
                break
                ;;
        esac
    done

    # Load configuration if specified
    if [[ -n "$config_file" ]]; then
        load_config "$config_file" || return 2
    fi

    return 0
}

###############################################################################
# BEST PRACTICE #9: Modular Functions (Google)
###############################################################################

#######################################
# Example: Safe file reading
# Arguments:
#   $1 - File path
#   $2 - Default value (optional)
# Returns:
#   File contents or default value
#######################################
read_file_safe() {
    local filepath="$1"
    local default="${2:-}"

    # Validate path
    if ! validate_path "$filepath"; then
        echo "$default"
        return 1
    fi

    # Check if file exists and is readable
    if [[ ! -f "$filepath" ]]; then
        log_warn "File not found: $filepath"
        echo "$default"
        return 1
    fi

    if [[ ! -r "$filepath" ]]; then
        log_error "File not readable: $filepath"
        echo "$default"
        return 3
    fi

    # Read file (BEST PRACTICE: Use built-in instead of cat)
    local content
    content=$(< "$filepath") || {
        log_error "Failed to read file: $filepath"
        echo "$default"
        return 1
    }

    echo "$content"
}

#######################################
# Example: Atomic file writing
# Arguments:
#   $1 - File path
#   $2 - Content
# Returns:
#   0 on success, 1 on failure
#######################################
write_file_atomic() {
    local filepath="$1"
    local content="$2"

    # Validate path
    if ! validate_path "$filepath"; then
        return 1
    fi

    # Create temp file
    local temp_file
    temp_file=$(mktemp) || {
        log_error "Failed to create temp file"
        return 1
    }

    # Add to cleanup list
    TEMP_FILES+=("$temp_file")

    # Write to temp file
    if ! echo "$content" > "$temp_file"; then
        log_error "Failed to write to temp file: $temp_file"
        return 1
    fi

    # Atomic rename
    if ! mv "$temp_file" "$filepath"; then
        log_error "Failed to move temp file to: $filepath"
        return 1
    fi

    log_debug "File written atomically: $filepath"
    return 0
}

#######################################
# Example: Network operation with retry
# Arguments:
#   $1 - URL
#   $2 - Max retries (default: 3)
# Returns:
#   0 on success, 1 on failure
#######################################
fetch_url_with_retry() {
    local url="$1"
    local max_retries="${2:-3}"
    local retry_count=0
    local wait_time=2

    # Validate URL format
    if [[ ! "$url" =~ ^https?:// ]]; then
        log_error "Invalid URL format: $url"
        return 1
    fi

    while (( retry_count < max_retries )); do
        log_debug "Fetching URL (attempt $((retry_count + 1))/$max_retries): $url"

        if curl -fsSL --max-time 10 "$url" -o /dev/null; then
            log_info "Successfully fetched: $url"
            return 0
        fi

        ((retry_count++))
        if (( retry_count < max_retries )); then
            log_warn "Fetch failed, retrying in ${wait_time}s..."
            sleep "$wait_time"
            wait_time=$((wait_time * 2))  # Exponential backoff
        fi
    done

    log_error "Failed to fetch URL after $max_retries attempts: $url"
    return 1
}

###############################################################################
# BEST PRACTICE #10: Parallel Processing (Performance)
###############################################################################

#######################################
# Process items in parallel
# Arguments:
#   $1 - Function name to call
#   $2 - Max parallel jobs
#   $@ - Items to process
# Returns:
#   0 on success, 1 if any job failed
#######################################
parallel_process() {
    local func_name="$1"
    local max_jobs="$2"
    shift 2
    local items=("$@")
    local failed=0

    log_info "Processing ${#items[@]} items in parallel (max $max_jobs jobs)"

    for item in "${items[@]}"; do
        # Wait if max jobs reached
        while (( $(jobs -r | wc -l) >= max_jobs )); do
            sleep 0.1
        done

        # Start background job
        (
            if ! "$func_name" "$item"; then
                log_error "Failed to process: $item"
                exit 1
            fi
        ) &
        CLEANUP_PIDS+=($!)
    done

    # Wait for all jobs to complete
    for pid in "${CLEANUP_PIDS[@]}"; do
        if ! wait "$pid"; then
            failed=1
        fi
    done

    if (( failed == 0 )); then
        log_info "All items processed successfully"
        return 0
    else
        log_error "Some items failed to process"
        return 1
    fi
}

###############################################################################
# Main Application Logic
###############################################################################

#######################################
# Initialize application
# Returns:
#   0 on success, non-zero on error
#######################################
initialize() {
    log_info "Initializing $SCRIPT_NAME v$SCRIPT_VERSION"

    # Check dependencies
    check_dependencies curl date mktemp

    # Create log directory if needed
    local log_dir
    log_dir="$(dirname "$DEFAULT_LOG_FILE")"
    if [[ ! -d "$log_dir" ]]; then
        mkdir -p "$log_dir" || {
            log_error "Failed to create log directory: $log_dir"
            return 2
        }
    fi

    log_info "Initialization complete"
    return 0
}

#######################################
# Main application function
# Returns:
#   0 on success, non-zero on error
#######################################
main() {
    # Initialize
    initialize || return $?

    # Example: Demonstrate input validation
    log_info "=== Demonstrating Input Validation ==="
    if validate_input "user123" "^[a-zA-Z0-9_-]+$" "Invalid username"; then
        log_info "✓ Valid username"
    fi

    if ! validate_input "../../etc/passwd" "^[a-zA-Z0-9_-]+$" "Invalid filename"; then
        log_warn "✗ Invalid filename (prevented injection)"
    fi

    # Example: Demonstrate safe file operations
    log_info "=== Demonstrating Safe File Operations ==="
    local test_file="/tmp/test_${RANDOM}.txt"
    if write_file_atomic "$test_file" "Hello, World!"; then
        log_info "✓ File written atomically"

        local content
        content=$(read_file_safe "$test_file" "default")
        log_info "✓ File content: $content"

        rm -f "$test_file"
    fi

    # Example: Demonstrate retry mechanism
    log_info "=== Demonstrating Retry Mechanism ==="
    if fetch_url_with_retry "https://www.google.com" 3; then
        log_info "✓ URL fetched successfully"
    fi

    log_info "=== All demonstrations complete ==="
    return 0
}

###############################################################################
# Script Entry Point
###############################################################################

# Only run main if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    # Parse arguments
    parse_arguments "$@" || exit $?

    # Run main
    main || exit $?

    # Success
    log_info "$SCRIPT_NAME completed successfully"
    exit 0
fi
