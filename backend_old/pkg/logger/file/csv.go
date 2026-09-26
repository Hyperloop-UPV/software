package file

import (
	"encoding/csv"
	"os"
	"sync"
)

// CSV is a CSV file representation that is safe to read and write concurrently.
type CSV struct {
	lock   *sync.Mutex
	file   *os.File
	writer *csv.Writer
	reader *csv.Reader
}

func NewCSV(file *os.File) *CSV {
	return &CSV{
		lock:   new(sync.Mutex),
		file:   file,
		writer: csv.NewWriter(file),
		reader: csv.NewReader(file),
	}
}

func (file *CSV) Write(record []string) error {
	file.lock.Lock()
	defer file.lock.Unlock()
	return file.writer.Write(record)
}

func (file *CSV) Read() (record []string, err error) {
	file.lock.Lock()
	defer file.lock.Unlock()
	return file.reader.Read()
}

func (file *CSV) Flush() {
	file.lock.Lock()
	defer file.lock.Unlock()
	file.writer.Flush()
}

func (file *CSV) Close() error {
	file.Flush()
	return file.file.Close()
}
