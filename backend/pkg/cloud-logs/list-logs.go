package cloud_logs

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

type Logs struct {
	Count int    `json:"count"`
	Logs  []File `json:"logs"`
}

type File struct {
	Id           int    `json:"id"`
	Filename     string `json:"filename"`
	Content_type string `json:"content:type"`
	Size_bytes   int    `json:"size_bytes"`
}

type Lister struct {
	Endpoint string
	Client   *http.Client
}

func (l *Lister) setDefault() {
	l.Endpoint = "http://localhost:8080/logs/list"
	l.Client = &http.Client{}
}

func (l *Lister) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	l.setDefault()
	list, err := get_logs_list(l)
	if err != nil {
		fmt.Print(err)
		w.WriteHeader(400)
	}

	jsonData, _ := json.Marshal(list)
	w.Write(jsonData)
}

func get_logs_list(l *Lister) (Logs, error) {

	log_list := Logs{}
	req, err := http.NewRequest("GET", l.Endpoint, nil)
	if err != nil {
		fmt.Printf("error req")
		return log_list, errors.New("Error making request ")
	}

	res, err := l.Client.Do(req)
	if err != nil {
		return log_list, errors.New("Error getting list of logs")
	}

	decoder := json.NewDecoder(res.Body)
	err = decoder.Decode(&log_list)
	if err != nil {
		fmt.Printf("error decoding")
		return log_list, err
	}
	defer res.Body.Close()

	fmt.Print(log_list)
	return log_list, nil
}
