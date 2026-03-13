package cloud_logs

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type Downloader struct {
	Endpoint string
	Client   *http.Client
}

func (d *Downloader) setDefault() {
	d.Endpoint = "http://localhost:8080/logs/download"
	d.Client = &http.Client{}
}
func (d *Downloader) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	decoder := json.NewDecoder(req.Body)
	d.setDefault()
	chosen_file := File{}
	decoder.Decode(&chosen_file)
	path := fmt.Sprintf("%v/%v", d.Endpoint, chosen_file.Id)
	res, err := download(d, path)
	fmt.Print(res)
	if err != nil {
		fmt.Printf("%v", err)
		w.Write([]byte("400"))
	}

	w.Header().Set("Content-Disposition", res.Header.Get("Content-Disposition"))
	w.Header().Set("Content-Type", res.Header.Get("Content-Type"))

	io.Copy(w, res.Body)
	defer res.Body.Close()
	if err != nil {
		fmt.Errorf(err.Error())
	}
}

func download(d *Downloader, path string) (*http.Response, error) {
	fmt.Print(path)
	req, err := http.NewRequest("GET", path, nil)
	if err != nil {
		return nil, errors.New("error creating http request")
	}

	res, err := d.Client.Do(req)
	if err != nil {
		return nil, errors.New("error making download request")
	}

	return res, nil
}
