package boards

import (
	"bytes"
	"fmt"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/network/tftp"
	dataPacket "github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

const (
	BlcuName = "target"

	AckId           = abstraction.BoardEvent("ACK")
	DownloadEventId = abstraction.BoardEvent("DOWNLOAD")
	UploadEventId   = abstraction.BoardEvent("UPLOAD")

	// Default order IDs - can be overridden via config.toml
	DefaultBlcuDownloadOrderId = 701
	DefaultBlcuUploadOrderId   = 700
)

type TFTPConfig struct {
	BlockSize      int
	Retries        int
	TimeoutMs      int
	BackoffFactor  int
	EnableProgress bool
}

type BLCU struct {
	api             abstraction.BoardAPI
	tftpStatusChan  chan bool
	ip              string
	tftpConfig      TFTPConfig
	id              abstraction.BoardId
	downloadOrderId uint16
	uploadOrderId   uint16
}

// Deprecated: Use NewWithConfig with proper board ID and order IDs from configuration
func New(ip string) *BLCU {
	return NewWithTFTPConfig(ip, TFTPConfig{
		BlockSize:      131072, // 128kB
		Retries:        3,
		TimeoutMs:      5000,
		BackoffFactor:  2,
		EnableProgress: true,
	}, 0) // Board ID 0 indicates missing configuration
}

// Deprecated: Use NewWithConfig for proper order ID configuration
func NewWithTFTPConfig(ip string, tftpConfig TFTPConfig, id abstraction.BoardId) *BLCU {
	return &BLCU{
		tftpStatusChan:  make(chan bool, 1),
		ip:              ip,
		tftpConfig:      tftpConfig,
		id:              id,
		downloadOrderId: DefaultBlcuDownloadOrderId,
		uploadOrderId:   DefaultBlcuUploadOrderId,
	}
}

func NewWithConfig(ip string, tftpConfig TFTPConfig, id abstraction.BoardId, downloadOrderId, uploadOrderId uint16) *BLCU {
	return &BLCU{
		tftpStatusChan:  make(chan bool, 1),
		ip:              ip,
		tftpConfig:      tftpConfig,
		id:              id,
		downloadOrderId: downloadOrderId,
		uploadOrderId:   uploadOrderId,
	}
}
func (board *BLCU) Id() abstraction.BoardId {
	return board.id
}

func (boards *BLCU) Notify(boardNotification abstraction.BoardNotification) {
	switch notification := boardNotification.(type) {
	case *TFTPStatusNotification:
		boards.tftpStatusChan <- notification.IsTFTPEnabled

	case *DownloadEvent:
		err := boards.download(*notification)
		if err != nil {
			fmt.Println(ErrDownloadFailure{
				Timestamp: time.Now(),
				Inner:     err,
			}.Error())
		}
	case *UploadEvent:
		fmt.Println("Received upload event for board:", notification.Board)
		err := boards.upload(*notification)
		if err != nil {
			fmt.Println(ErrUploadFailure{
				Timestamp: time.Now(),
				Inner:     err,
			}.Error())
		}
	default:
		fmt.Println(ErrInvalidBoardEvent{
			Event:     notification.Event(),
			Timestamp: time.Now(),
		}.Error())
	}
}

func (boards *BLCU) SetAPI(api abstraction.BoardAPI) {
	boards.api = api
}

func (boards *BLCU) download(notification DownloadEvent) error {
	// Notify the BLCU
	ping := dataPacket.NewPacketWithValues(
		abstraction.PacketId(boards.downloadOrderId),
		map[dataPacket.ValueName]dataPacket.Value{
			BlcuName: dataPacket.NewEnumValue(dataPacket.EnumVariant(notification.Board)),
		},
		map[dataPacket.ValueName]bool{
			BlcuName: true,
		})

	err := boards.api.SendMessage(transport.NewPacketMessage(ping))
	if err != nil {
		// Couldn't connect to the BLCU
		return ErrSendMessageFailed{
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	// Wait for TFTP enabled status
	select {
	case isTFTPEnabled := <-boards.tftpStatusChan:
		if !isTFTPEnabled {
			return ErrSendMessageFailed{
				Timestamp: time.Now(),
				Inner:     fmt.Errorf("TFTP not enabled on BLCU device"),
			}
		}
	case <-time.After(10 * time.Second):
		return ErrSendMessageFailed{
			Timestamp: time.Now(),
			Inner:     fmt.Errorf("timeout waiting for TFTP status"),
		}
	}

	// TODO! Notify on progress

	// Start TFTP client
	client, err := tftp.NewClient(boards.ip,
		tftp.WithBlockSize(boards.tftpConfig.BlockSize),
		tftp.WithRetries(boards.tftpConfig.Retries),
		tftp.WithTimeout(time.Duration(boards.tftpConfig.TimeoutMs)*time.Millisecond),
	)
	if err != nil {
		return ErrNewClientFailed{
			Addr:      boards.ip,
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	// Download the file
	buffer := &bytes.Buffer{}

	_, err = client.ReadFile(BlcuName, tftp.BinaryMode, buffer)
	if err != nil {
		pushErr := boards.api.SendPush(abstraction.BrokerPush(
			&DownloadFailure{
				Error: err,
			},
		))
		if pushErr != nil {
			return ErrSendMessageFailed{
				Timestamp: time.Now(),
				Inner:     pushErr,
			}
		}

		return ErrReadingFileFailed{
			Filename:  string(notification.Event()),
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	// Notify success to front
	pushErr := boards.api.SendPush(abstraction.BrokerPush(
		&DownloadSuccess{
			Data: buffer.Bytes(),
		},
	))
	if pushErr != nil {
		return ErrSendMessageFailed{
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	return nil
}

func (boards *BLCU) upload(notification UploadEvent) error {
	fmt.Println("Uploading BLCU firmware...")

	// Create new packet with board update command
	ping := dataPacket.NewPacketWithValues(abstraction.PacketId(boards.uploadOrderId), // 700
		map[dataPacket.ValueName]dataPacket.Value{
			BlcuName: dataPacket.NewEnumValue(dataPacket.EnumVariant(notification.Board)), // The board to be updated
		},
		map[dataPacket.ValueName]bool{ // True
			BlcuName: true,
		})
	fmt.Println("Notifying BLCU...", ping)

	// Actually send the message
	err := boards.api.SendMessage(transport.NewPacketMessage(ping))
	if err != nil {
		// Couldn't connect to the BLCU
		fmt.Println("Failed to send upload ping:", err)
		return ErrSendMessageFailed{
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	// Wait for TFTP enabled status
	fmt.Println("Waiting for TFTP status...")
	select {
	case isTFTPEnabled := <-boards.tftpStatusChan:
		if !isTFTPEnabled {
			fmt.Println("TFTP not enabled on BLCU device")
			return ErrSendMessageFailed{
				Timestamp: time.Now(),
				Inner:     fmt.Errorf("TFTP not enabled on BLCU device"),
			}
		}
		fmt.Println("TFTP enabled, starting upload...")
	case <-time.After(10 * time.Second):
		fmt.Println("Timeout waiting for TFTP status")
		return ErrSendMessageFailed{
			Timestamp: time.Now(),
			Inner:     fmt.Errorf("timeout waiting for TFTP status"),
		}
	}

	// TODO! Notify on progress

	// Start TFTP client
	// TODO: Check if it fails here
	client, err := tftp.NewClient(boards.ip,
		tftp.WithBlockSize(boards.tftpConfig.BlockSize),
		tftp.WithRetries(boards.tftpConfig.Retries),
		tftp.WithTimeout(time.Duration(boards.tftpConfig.TimeoutMs)*time.Millisecond),
	)
	if err != nil {
		fmt.Println("Failed to create TFTP client:", err)
		return ErrNewClientFailed{
			Addr:      boards.ip,
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	// Get the update payload and prepare the buffer
	data := notification.Data
	buffer := bytes.NewBuffer(data)

	// Write the file
	read, err := client.WriteFile(BlcuName, tftp.BinaryMode, buffer)
	if err != nil {
		pushErr := boards.api.SendPush(abstraction.BrokerPush(
			&UploadFailure{
				Error: err,
			}))
		if pushErr != nil {
			return ErrSendMessageFailed{
				Timestamp: time.Now(),
				Inner:     pushErr,
			}
		}

		return ErrReadingFileFailed{
			Filename:  string(notification.Event()),
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	// Check if all bytes written
	if int(read) != len(data) {
		err = ErrNotAllBytesWritten{
			Timestamp: time.Now(),
		}

		pushErr := boards.api.SendPush(abstraction.BrokerPush(
			&UploadFailure{
				Error: err,
			}))
		if pushErr != nil {
			return ErrSendMessageFailed{
				Timestamp: time.Now(),
				Inner:     pushErr,
			}
		}

		return err
	}

	// Notify success to front
	pushErr := boards.api.SendPush(abstraction.BrokerPush(
		&UploadSuccess{}))
	if pushErr != nil {
		return ErrSendMessageFailed{
			Timestamp: time.Now(),
			Inner:     pushErr,
		}
	}
	return nil
}
