package cloud_logs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

type Filepath struct {
	Path string `json:"filepath"`
}

type Uploader struct {
	Endpoint string
	Client   *http.Client
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
		fmt.Errorf(err.Error())
		w.WriteHeader(400)
	}

	defer file.Close()

	body := &bytes.Buffer{}

	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filepath.Base(path.Path))
	if err != nil {
		fmt.Errorf(err.Error())
		w.WriteHeader(400)
	}

	io.Copy(part, file)

	defer writer.Close()

	req, err = http.NewRequest("POST", u.Endpoint, body)
	if err != nil {
		fmt.Errorf(err.Error())
		w.WriteHeader(400)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	u.Client.Do(req)

}
