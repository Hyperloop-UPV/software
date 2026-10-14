package http

import (
	"net/http"
)

type endpoint struct {
	http.Handler
	Path string
}

func Endpoint(path string, handler http.Handler) endpoint {
	return endpoint{
		Handler: handler,
		Path:    path,
	}
}

func NewMux(endpoints ...endpoint) *http.ServeMux {
	mux := http.NewServeMux()
	for _, endpoint := range endpoints {
		mux.Handle(endpoint.Path, endpoint)
	}
	return mux
}
