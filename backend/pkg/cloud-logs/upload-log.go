package cloud_logs

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

type Uploader struct {
	Endpoint string
	Client   *http.Client
	Auth     *CloudState
}

func (u *Uploader) setDefault() {
	u.Endpoint = "http://localhost:8080/logs/upload"
	u.Client = &http.Client{}
}

func (u *Uploader) ServeHTTP(w http.ResponseWriter, req *http.Request) {

	path := Filepath{}
	u.setDefault()
	decoder := json.NewDecoder(req.Body)

	decoder.Decode(&path)

	file, err := os.Open(path.Path)
	if err != nil {
		w.WriteHeader(400)
	}

	defer file.Close()

	body := &bytes.Buffer{}

	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filepath.Base(path.Path))
	if err != nil {
		w.WriteHeader(400)
	}

	io.Copy(part, file)

	writer.Close()

	req, err = http.NewRequest("POST", u.Endpoint, body)
	if err != nil {
		w.WriteHeader(400)
	}

	req.Header.Set("Authorization", "Bearer "+u.Auth.CloudToken)

	req.Header.Set("Content-Type", writer.FormDataContentType())

	u.Client.Do(req)

}
