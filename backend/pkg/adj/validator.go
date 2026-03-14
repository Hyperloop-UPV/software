package adj

import (
	"os/exec"
	"path"
	"strings"

	trace "github.com/rs/zerolog/log"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/validator"
)

func Validate() {

	trace.Info().Msg("Starting ADJ-Validator")

	// Check for Python interpreter is installed and accessible
	pyCmd := pythonCommand()
	if pyCmd == "" {
		trace.Fatal().Msg("No Python interpreter found in PATH. Please install Python 3 and ensure it's accessible via 'python3', 'python', or 'py' command.")
	}

	// Construct the full path to the ADJ validator script
	validatorPath := path.Join(RepoPath, ADJValidatorScript)

	trace.Debug().Msgf("Running ADJ Validator using command: %s %s --no-color", pyCmd, validatorPath)

	// Execute the ADJ validator script and capture its output
	cmd := exec.Command(pyCmd, validatorPath, "--no-color")
	output, err := cmd.CombinedOutput()

	// Log the output of the validator for debugging purposes
	validator.LogADJValidatorOutput(output)

	// If the command returns a non-zero exit code, it indicates a validation failure or an error during execution
	if err != nil {

		if strings.Contains(string(output), "JSON Validation Script") {

			trace.Fatal().Msg("ADJ Validator failed with error, check the output for details.")

		}

		trace.Fatal().Msgf("Error executing ADJ Validator with command '%s %s'. Ensure that you have installed jsonschema with 'pip install jsonschema==4.25.0' and is accessible in your PATH.", pyCmd, validatorPath)

	}

}

// pythonCommand returns the name of a Python interpreter executable
// available in the current system PATH.
//
// It checks a list of common Python command names in order of preference:
//   - "python3" (typical on Linux/macOS)
//   - "python"  (may point to Python 3 on many systems)
//   - "py"      (Python launcher commonly available on Windows)
//
// For each candidate, exec.LookPath is used to determine whether the
// executable can be found in the PATH. The function returns the first
// command that exists.
//
// If none of the candidates are found, an empty string is returned,
// indicating that no Python interpreter is available.
func pythonCommand() string {
	candidates := []string{"python3", "python", "py"}

	for _, c := range candidates {
		_, err := exec.LookPath(c)
		if err == nil {
			return c
		}
	}

	return ""
}
