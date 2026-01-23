package adj

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
)

const (
	RepoURL = "https://github.com/Hyperloop-UPV/adj.git" // URL of the ADJ repository
)

var RepoPath = getRepoPath()

// obtain the path to store the ADJ repository
func getRepoPath() string {
	// Use cache directory for ADJ (can be regenerated)
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		// This should never happen in practice, but handle it just in case
		panic(fmt.Sprintf("Failed to get user cache directory: %v", err))
	}

	// Use same directory structure as trace files: control-station/adj/
	adjDir := filepath.Join(cacheDir, "hyperloop-control-station", "adj")
	absPath, err := filepath.Abs(adjDir)
	if err != nil {
		panic(fmt.Sprintf("Failed to resolve ADJ path: %v", err))
	}
	return absPath + string(filepath.Separator)
}

// NewADJ creates and returns a new ADJ struct by downloading and parsing
// the ADJ repository from the specified branch.
func NewADJ(AdjBranch string) (ADJ, error) {

	// Get ADJ
	infoRaw, boardsRaw, err := downloadADJ(AdjBranch)
	if err != nil {
		return ADJ{}, err
	}

	// Parse ADJ general info
	var infoJSON InfoJSON
	if err := json.Unmarshal(infoRaw, &infoJSON); err != nil {
		println("Info JSON unmarshal error")
		return ADJ{}, err
	}

	// Build ADJ Info
	var info = Info{
		Ports:      infoJSON.Ports,
		MessageIds: infoJSON.MessageIds,
		Units:      make(map[string]utils.Operations),
	}
	// Parse operations for each unit
	for key, value := range infoJSON.Units {
		info.Units[key], err = utils.NewOperations(value)
		if err != nil {
			return ADJ{}, err
		}
	}

	// Parse ADJ boards
	var boardsList map[string]string
	if err := json.Unmarshal(boardsRaw, &boardsList); err != nil {
		return ADJ{}, err
	}

	// generate Boards map
	boards, err := getBoards(RepoPath, boardsList)
	if err != nil {
		return ADJ{}, err
	}

	// Generate BoardIds map
	info.BoardIds, err = getBoardIds(boardsList)
	if err != nil {
		return ADJ{}, err
	}

	// Generate Addresses map
	info.Addresses, err = getAddresses(boards)
	if err != nil {
		return ADJ{}, err
	}
	for target, address := range infoJSON.Addresses {
		info.Addresses[target] = address
	}

	// Return ADJ struct
	adj := ADJ{
		Info:   info,
		Boards: boards,
	}

	return adj, nil
}

// downloadADJ clones or updates the ADJ repository and reads the general_info.json and boards.json files.
func downloadADJ(AdjBranch string) (json.RawMessage, json.RawMessage, error) {
	updateRepo(AdjBranch)

	// Read general_info.json and boards.json
	info, err := os.ReadFile(RepoPath + "general_info.json")
	if err != nil {
		return nil, nil, err
	}

	boardsList, err := os.ReadFile(RepoPath + "boards.json")
	if err != nil {
		return nil, nil, err
	}

	return info, boardsList, nil
}
