package http

import "net/http"

func NewServer(address string, mux *http.ServeMux) *http.Server {
	return &http.Server{
		Addr:    address,
		Handler: mux,
	}
}
