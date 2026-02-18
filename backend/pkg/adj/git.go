package adj

import (
	"log"
	"os"
	"path/filepath"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

// WARNING: Doing tricks on it
func updateRepo(AdjBranch string) error {
	var err error

	if AdjBranch == "" {
		// Makes use of user's custom ADJ
		return nil
	} else {
		cloneOptions := &git.CloneOptions{
			URL:           RepoUrl,
			ReferenceName: plumbing.NewBranchReferenceName(AdjBranch),
			SingleBranch:  true,
			Depth:         1,
		}

		// Try to clone the ADJ to a temp directory to check for accessibility to the repo (also checks internet connection)
		tempPath := filepath.Join(os.TempDir(), "temp_adj")

		// Remove previous failed cloning attempts
		if err = os.RemoveAll(tempPath); err != nil {
			return err
		}

		// Try to import the ADJ to the temp directory
		_, err = git.PlainClone(tempPath, false, cloneOptions)
		if err != nil {
			// If the clone fails, work with the local ADJ
			log.Printf("Warning: Could not clone ADJ branch '%s' from remote. Working with local ADJ. Error: %v", AdjBranch, err)
			return nil
		}

		// If the clone is succesful, delete the temp files
		if err = os.RemoveAll(tempPath); err != nil {
			return err
		}

		if _, err = os.Stat(RepoPath); os.IsNotExist(err) {
			_, err = git.PlainClone(RepoPath, false, cloneOptions)
			if err != nil {
				return err
			}
		} else {
			if err = os.RemoveAll(RepoPath); err != nil {
				return err
			}
			_, err = git.PlainClone(RepoPath, false, cloneOptions)
			if err != nil {
				return err
			}
		}
	}

	return nil
}
