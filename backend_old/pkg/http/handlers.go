package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

type handleData struct {
	name    string
	modTime time.Time
	data    io.ReadSeeker
	dataMx  *sync.Mutex
}

func HandleData(name string, data io.ReadSeeker) *handleData {
	return &handleData{
		name:    name,
		modTime: time.Now(),
		data:    data,
		dataMx:  new(sync.Mutex),
	}
}

func HandleDataJSON(name string, data any) (*handleData, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	reader := bytes.NewReader(raw)

	return HandleData(name, reader), nil
}

func (handle *handleData) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()

	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Pragma", "no-cache")
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	handle.dataMx.Lock()
	defer handle.dataMx.Unlock()
	http.ServeContent(writer, request, handle.name, handle.modTime, handle.data)
}

type handleStatic struct {
	server http.Handler
}

func HandleStatic(path string) *handleStatic {
	return &handleStatic{
		server: http.FileServer(http.Dir(path)),
	}
}

func (handle *handleStatic) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()

	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Pragma", "no-cache")
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	handle.server.ServeHTTP(writer, request)
}
