package adj

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
)

const (
	RepoUrl = "https://github.com/HyperloopUPV-H8/adj.git" // URL of the ADJ repository

)

var RepoPath = getRepoPath()

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

func NewADJ(AdjBranch string) (ADJ, error) {
	infoRaw, boardsRaw, err := downloadADJ(AdjBranch)
	if err != nil {
		return ADJ{}, err
	}

	var infoJSON InfoJSON
	if err := json.Unmarshal(infoRaw, &infoJSON); err != nil {
		println("Info JSON unmarshal error")
		return ADJ{}, err
	}

	var info = Info{
		Ports:      infoJSON.Ports,
		MessageIds: infoJSON.MessageIds,
		Units:      make(map[string]utils.Operations),
	}
	for key, value := range infoJSON.Units {
		info.Units[key], err = utils.NewOperations(value)
		if err != nil {
			return ADJ{}, err
		}
	}

	var boardsList map[string]string
	if err := json.Unmarshal(boardsRaw, &boardsList); err != nil {
		return ADJ{}, err
	}

	boards, err := getBoards(RepoPath, boardsList)
	if err != nil {
		return ADJ{}, err
	}

	info.BoardIds, err = getBoardIds(boardsList)
	if err != nil {
		return ADJ{}, err
	}

	info.Addresses, err = getAddresses(boards)
	if err != nil {
		return ADJ{}, err
	}
	for target, address := range infoJSON.Addresses {
		info.Addresses[target] = address
	}

	adj := ADJ{
		Info:   info,
		Boards: boards,
	}

	return adj, nil
}

func downloadADJ(AdjBranch string) (json.RawMessage, json.RawMessage, error) {
	updateRepo(AdjBranch)

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
