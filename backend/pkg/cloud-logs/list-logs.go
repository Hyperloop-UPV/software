package cloud_logs

import (
	"encoding/json"
	"net/http"
)

type Lister struct {
	Endpoint string
	Client   *http.Client
	Auth     *CloudState
}

func (l *Lister) setDefault() {
	l.Endpoint = "http://localhost:8080/logs/list"
	l.Client = &http.Client{}
}

func (l *Lister) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	l.setDefault()
	list, err := get_logs_list(l)
	if err != nil {
		w.WriteHeader(400)
	}

	jsonData, _ := json.Marshal(list)
	w.Write(jsonData)
}

func get_logs_list(l *Lister) (Logs, error) {

	log_list := Logs{}
	req, err := http.NewRequest("GET", l.Endpoint, nil)
	if err != nil {
		return log_list, err
	}

	req.Header.Set("Authorization", "Bearer "+l.Auth.CloudToken)

	res, err := l.Client.Do(req)
	if err != nil {
		return log_list, err
	}

	decoder := json.NewDecoder(res.Body)
	err = decoder.Decode(&log_list)
	if err != nil {
		return log_list, err
	}
	defer res.Body.Close()

	return log_list, nil
}
