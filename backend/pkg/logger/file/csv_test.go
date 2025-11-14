package file

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"testing"
)

func TestCSVWriteRead(t *testing.T) {
	// Create temp file
	f, err := os.CreateTemp(t.TempDir(), "test*.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	c := NewCSV(f)

	// header (don't needed)
	want := []string{"alpha", "beta", "gamma"}
	if err := c.Write(want); err != nil {
		t.Fatal(err)
	}
	c.Flush()

	// Verify physical file content
	data, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}

	// verify content
	gotContent := string(data)
	wantContent := "alpha,beta,gamma\n"
	if gotContent != wantContent {
		t.Fatalf("file content: got %q, want %q", gotContent, wantContent)
	}

	// Seek back to the beginning to read what was written
	if _, err := c.file.Seek(0, io.SeekStart); err != nil {
		t.Fatal(err)
	}

	got, err := c.Read()
	if err != nil {
		t.Fatal(err)
	}

	// Simple comparison by length and values
	if len(got) != len(want) {
		t.Fatalf("got %v fields, want %v", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("field %d: got %q, want %q", i, got[i], want[i])
		}
	}

	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestCSVConcurrentWriteRead(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "concurrent*.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	c := NewCSV(f)

	const (
		goroutines   = 20
		perGoroutine = 10
	)
	var wg sync.WaitGroup

	// Concurrent write
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for k := 0; k < perGoroutine; k++ {
				rec := []string{fmt.Sprintf("g%d", id), fmt.Sprintf("r%d", k)}
				if err := c.Write(rec); err != nil {

					t.Errorf("write error: %v", err)
				}
			}
		}(g)
	}
	wg.Wait()

	c.Flush()
	if _, err := c.file.Seek(0, io.SeekStart); err != nil {
		t.Fatal(err)
	}

	// Read all records
	count := 0
	for {
		_, err := c.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		count++
	}

	// compare counts
	want := goroutines * perGoroutine
	if count != want {
		t.Fatalf("got %d records, want %d", count, want)
	}

	// Verify number of physical lines in the file
	data, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(string(data), "\n")
	// remove final empty line if exists
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	if len(lines) != want {
		t.Fatalf("file lines: got %d, want %d", len(lines), want)
	}

	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
}

// Checks that Close actually closes the underlying file.
func TestCSVCloseClosesFile(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "close*.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	c := NewCSV(f)

	if err := c.Close(); err != nil {
		t.Fatal(err)
	}

	// Intentar escribir en el archivo cerrado debe producir error
	if _, err := f.Write([]byte("x")); err == nil {
		t.Fatal("expected error when writing to closed file, got nil")
	}
}
