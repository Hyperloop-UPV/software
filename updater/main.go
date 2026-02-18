package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	repoOwner = "HyperloopUPV-H8"
	repoName  = "software"
)

func main() {
	// Detect the operating system
	zipName := getZipName()

	// Check if the `../backend/` folder exists
	if _, err := os.Stat("../backend"); err == nil {
		fmt.Println("Directory '../backend' found. Updating from the repository...")
		updateFromGit()
	} else {
		fmt.Println("Directory '../backend' not found. Checking binaries...")
		updateFromBinaries(zipName)
	}
}

func getZipName() string {
	switch runtime.GOOS {
	case "windows":
		return "windows"
	case "darwin":
		if strings.Contains(runtime.GOARCH, "arm") {
			return "macos-arm64"
		}
		return "macos-intel"
	case "linux":
		return "linux"
	default:
		fmt.Fprintf(os.Stderr, "Unsupported operating system: %s\n", runtime.GOOS)
		os.Exit(1)
		return ""
	}
}

func updateFromGit() {
	// Run `git pull` in the `../backend` folder
	cmd := exec.Command("git", "-C", "../backend", "pull")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running git pull: %v\n", err)
		os.Exit(1)
	}

	// Run `go mod tidy` to update dependencies
	cmd = exec.Command("go", "mod", "tidy")
	cmd.Dir = "../backend"
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running go mod tidy: %v\n", err)
		os.Exit(1)
	}

	// Run `go build` in the `../backend` folder
	cmd = exec.Command("go", "build", "-o", "../backend/cmd/cmd.exe", "../backend/cmd/...")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running go build: %v\n", err)
		os.Exit(1)
	}

	// Launch the compiled executable
	launchExecutable("../backend/cmd/cmd")
}

// Check if a process is running by its name
func isProcessRunning(processName string) (bool, error) {
	cmd := exec.Command("tasklist", "/FI", fmt.Sprintf("IMAGENAME eq %s", processName))
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}
	return strings.Contains(string(output), processName), nil
}

func stopProcess(processName string) error {
	cmd := exec.Command("taskkill", "/IM", processName, "/F")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("taskkill failed: %v - output: %s", err, output)
	}
	fmt.Printf("Process %s stopped successfully.\n", processName)
	return nil
}

func updateFromBinaries(zipBase string) {
	binary := "backend"
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}

	// Stop and remove old binary if exists
	if _, err := os.Stat("./" + binary); err == nil {
		isRunning, err := isProcessRunning(binary)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error checking if process is running: %v\n", err)
			os.Exit(1)
		}
		if isRunning {
			fmt.Printf("Process %s is running. Stopping it...\n", binary)
			if err := stopProcess(binary); err != nil {
				fmt.Fprintf(os.Stderr, "Error stopping process %s: %v\n", binary, err)
				os.Exit(1)
			}
			time.Sleep(500 * time.Millisecond)
		}
		fmt.Printf("Deleting old binary: %s\n", binary)
		deleted := false
		for i := 0; i < 5; i++ {
			if err := os.Remove("./" + binary); err == nil {
				deleted = true
				break
			} else {
				fmt.Printf("Retrying delete (%d/5)...\n", i+1)
				time.Sleep(300 * time.Millisecond)
			}
		}
		if !deleted {
			fmt.Fprintf(os.Stderr, "Error deleting old binary after multiple attempts.\n")
			os.Exit(1)
		}
	}

	// Get the latest version from GitHub
	latestVersion, err := getLatestVersion()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting the latest version: %v\n", err)
		os.Exit(1)
	}

	zipFileName := fmt.Sprintf("%s-%s.zip", zipBase, latestVersion)
	url := fmt.Sprintf("https://github.com/%s/%s/releases/download/v%s/%s", repoOwner, repoName, latestVersion, zipFileName)
	fmt.Printf("Downloading ZIP from: %s\n", url)

	// Download the ZIP file
	err = downloadFile("./"+zipFileName, url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error downloading the ZIP file: %v\n", err)
		os.Exit(1)
	}

	// Extract the binary and VERSION.md from the ZIP file
	binaryPath, err := extractBinaryFromZip("./"+zipFileName, binary)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error extracting the binary: %v\n", err)
		os.Exit(1)
	}

	// Launch the extracted binary
	launchExecutable(binaryPath)
}

func downloadFile(filepath string, url string) error {
	// Create the file
	out, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer out.Close()

	// Get the data
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Write the body to file
	_, err = io.Copy(out, resp.Body)
	return err
}

func extractBinaryFromZip(zipPath, binaryName string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	var binaryPath string
	parentDir, _ := filepath.Abs(".")

	for _, f := range r.File {
		baseName := filepath.Base(f.Name)
		if baseName == binaryName || baseName == "VERSION.txt" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			defer rc.Close()

			outPath := filepath.Join(parentDir, baseName)
			outFile, err := os.Create(outPath)
			if err != nil {
				return "", err
			}
			defer outFile.Close()

			_, err = io.Copy(outFile, rc)
			if err != nil {
				return "", err
			}

			if baseName == binaryName {
				binaryPath = outPath
			}
		}
	}

	if binaryPath == "" {
		return "", fmt.Errorf("binary %s not found in ZIP", binaryName)
	}
	return binaryPath, nil
}

func getLatestVersion() (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", repoOwner, repoName)
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var release struct {
		TagName string `json:"tag_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", err
	}

	return strings.TrimPrefix(release.TagName, "v"), nil
}

func launchExecutable(path string) {
	if runtime.GOOS == "windows" && !strings.HasSuffix(path, ".exe") {
		path += ".exe"
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting the absolute path: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Launching executable: %s\n", absPath)

	cmd := exec.Command(absPath)
	cmd.Dir = filepath.Dir(absPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error launching the executable: %v\n", err)
		os.Exit(1)
	}
}
