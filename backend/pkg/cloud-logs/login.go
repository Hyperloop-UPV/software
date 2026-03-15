package cloud_logs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type CloudState struct {
	CloudHash   string
	CloudSecret string
	CloudToken  string
}

func (state *CloudState) Login() error {

	state.CloudHash = os.Getenv("AUTH_PASSWORD_HASH")
	state.CloudSecret = os.Getenv("JWT_SECRET")

	login := Logins{
		Password: state.CloudSecret,
	}

	body, err := json.Marshal(login)
	if err != nil {
		return fmt.Errorf(err.Error())
	}

	req, err := http.NewRequest("POST", "http://localhost:8080/auth/login", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf(err.Error())
	}
	client := &http.Client{}
	req.Header.Set("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf(err.Error())
	}

	token := Token{}

	decoder := json.NewDecoder(res.Body)
	defer res.Body.Close()

	err = decoder.Decode(&token)
	if err != nil {
		return fmt.Errorf(err.Error())
	}
	state.CloudToken = token.Token

	return nil
}
