//! DOES NOT WORK, BECAUSE IS ASSUMED THAT THE tmp FOLDER IS ALWAYS THE SAME DIRRECTION
//! which is not true

package main

import (
	"errors"
	"io"
	"os"
	"strconv"
	"strings"
	"syscall"

	trace "github.com/rs/zerolog/log"
)

var (
	ErrProcessRunning = errors.New("process is running")
)

func createPid(path string) {
	err := WritePid(path)

	if err != nil {
		switch err {
		case ErrProcessRunning:
			trace.Fatal().Err(err).Msg("Backend is already running")
		default:
			trace.Error().Err(err).Msg("pid error")
		}
	}
}

func WritePid(filename string) error {
	oldPid, err := getOldPid(filename)

	if err == nil && isProcessRunning(oldPid) {
		return ErrProcessRunning
	}

	file, err := os.Create(filename)

	if err != nil {
		return err
	}

	buf := []byte(strconv.Itoa(os.Getpid()))
	_, err = file.Write(buf)

	if err != nil {
		return err
	}

	return nil
}

func getOldPid(filename string) (int, error) {
	oldPidFile, err := os.Open(filename)
	if err != nil {
		return 0, err
	}

	buf, err := io.ReadAll(oldPidFile)
	if err != nil {
		return 0, err
	}

	oldPid, err := strconv.Atoi(strings.TrimSpace(string(buf)))
	if err != nil {
		return 0, err
	}

	return oldPid, nil
}

func isProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	err = process.Signal(syscall.Signal(0))

	return err == nil
}

func RemovePid(filename string) error {
	return os.RemoveAll(filename)
}
