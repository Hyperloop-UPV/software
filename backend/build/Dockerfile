FROM golang:1.21-alpine

RUN apk update
RUN apk add --no-cache libpcap-dev musl-dev gcc

WORKDIR /backend

COPY . /backend

RUN go mod tidy

ENV CGO_ENABLED=1
ENV GOARCH=amd64
ENV GOOS=linux

CMD go build -C "cmd" -ldflags '-linkmode external -extldflags "-static"' -o "../build/backend"