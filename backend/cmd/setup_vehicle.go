package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	vehicle_models "github.com/HyperloopUPV-H8/h9-backend/internal/vehicle/models"
	h "github.com/HyperloopUPV-H8/h9-backend/pkg/http"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"

	adj_module "github.com/HyperloopUPV-H8/h9-backend/internal/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
	"github.com/HyperloopUPV-H8/h9-backend/internal/config"
	"github.com/HyperloopUPV-H8/h9-backend/internal/pod_data"
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	blcu_topics "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/blcu"
	connection_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/connection"
	data_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/data"
	logger_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/logger"
	message_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/message"
	order_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	data_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
	vehicle_module "github.com/HyperloopUPV-H8/h9-backend/pkg/vehicle"
	"github.com/jmaralo/sntp"
	trace "github.com/rs/zerolog/log"
)

func configureBroker(subloggers SubloggersMap, loggerHandler *logger.Logger, idToBoard map[abstraction.PacketId]string, connections chan *websocket.Client) (*broker.Broker, func()) {

	broker := broker.New(trace.Logger)

	dataTopic := data_topic.NewUpdateTopic(time.Second / 10)
	cleanup := func() { dataTopic.Stop() }
	connectionTopic := connection_topic.NewUpdateTopic()
	orderTopic := order_topic.NewSendTopic()
	loggerTopic := logger_topic.NewEnableTopic()
	loggerTopic.SetDataLogger(subloggers[data_logger.Name].(*data_logger.Logger))
	loggerHandler.SetOnStart(func() {
		if err := loggerTopic.NotifyStarted(); err != nil {
			trace.Error().Err(err).Msg("failed to notify logger started")
		}
	})

	messageTopic := message_topic.NewUpdateTopic()
	stateOrderTopic := order_topic.NewState(idToBoard, trace.Logger)

	// congigure topics
	broker.AddTopic(data_topic.UpdateName, dataTopic)
	broker.AddTopic(connection_topic.UpdateName, connectionTopic)
	broker.AddTopic(order_topic.SendName, orderTopic)
	broker.AddTopic(order_topic.StateName, stateOrderTopic)
	broker.AddTopic(logger_topic.EnableName, loggerTopic)
	broker.AddTopic(logger_topic.ResponseName, loggerTopic)
	broker.AddTopic(logger_topic.VariablesName, loggerTopic)
	broker.AddTopic(message_topic.UpdateName, messageTopic)

	pool := websocket.NewPool(connections, trace.Logger)
	broker.SetPool(pool)
	blcu_topics.RegisterTopics(broker, pool)

	return broker, cleanup
}

func configureVehicle(

	broker *broker.Broker,
	loggerHandler *logger.Logger,
	updateFactory *update_factory.UpdateFactory,
	ipToBoardID map[string]abstraction.BoardId,
	idToBoard map[abstraction.PacketId]string,
	transp *transport.Transport,
	adj adj_module.ADJ,
	config config.Config,

) error {

	vehicle := vehicle_module.New(trace.Logger)
	vehicle.SetBroker(broker)
	vehicle.SetLogger(loggerHandler)
	vehicle.SetUpdateFactory(updateFactory)
	vehicle.SetIpToBoardId(ipToBoardID)
	vehicle.SetIdToBoardName(idToBoard)
	vehicle.SetTransport(transp)

	// Register BLCU board for handling bootloader operations
	if blcuIP, exists := adj.Info.Addresses[BLCU]; exists {
		blcuId, idExists := adj.Info.BoardIds["BLCU"]
		if !idExists {
			return fmt.Errorf("BLCU IP found in ADJ but board ID missing")
		} else {
			// Get configurable order IDs or use defaults
			downloadOrderId := config.Blcu.DownloadOrderId
			uploadOrderId := config.Blcu.UploadOrderId
			if downloadOrderId == 0 {
				downloadOrderId = boards.DefaultBlcuDownloadOrderId
			}
			if uploadOrderId == 0 {
				uploadOrderId = boards.DefaultBlcuUploadOrderId
			}

			tftpConfig := boards.TFTPConfig{
				BlockSize:      config.TFTP.BlockSize,
				Retries:        config.TFTP.Retries,
				TimeoutMs:      config.TFTP.TimeoutMs,
				BackoffFactor:  config.TFTP.BackoffFactor,
				EnableProgress: config.TFTP.EnableProgress,
			}
			blcuBoard := boards.NewWithConfig(blcuIP, tftpConfig, abstraction.BoardId(blcuId), downloadOrderId, uploadOrderId)
			vehicle.AddBoard(blcuBoard)
			vehicle.SetBlcuId(abstraction.BoardId(blcuId))

			trace.
				Info().
				Str("ip", blcuIP).
				Int("id", int(blcuId)).
				Uint16("download_order_id", downloadOrderId).
				Uint16("upload_order_id", uploadOrderId).
				Msg("BLCU board registered")
		}
	} else {
		trace.Warn().Msg("BLCU not found in ADJ configuration - bootloader operations unavailable")
	}

	return nil

}

func configureSNTP(adj adj_module.ADJ) bool {

	if *enableSNTP {
		sntpAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", adj.Info.Addresses[BACKEND], adj.Info.Ports[SNTP]))
		if err != nil {
			fmt.Fprintf(os.Stderr, "error resolving sntp address: %v\n", err)
			return true
		}
		sntpServer, err := sntp.NewUnicast("udp", sntpAddr)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error creating sntp server: %v\n", err)
			return true
		}

		go func() {
			err := sntpServer.ListenAndServe()
			if err != nil {
				fmt.Fprintf(os.Stderr, "error listening sntp server: %v\n", err)
				return
			}
		}()

	}

	return false
}

func configureHttpServer(
	adj adj_module.ADJ,
	podData pod_data.PodData,
	vehicleOrders vehicle_models.VehicleOrders,
	upgrader *websocket.Upgrader,
	config config.Config) {
	podDataHandle, err := h.HandleDataJSON("podData.json", pod_data.GetDataOnlyPodData(podData))
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating podData handler: %v\n", err)
	}
	orderDataHandle, err := h.HandleDataJSON("orderData.json", vehicleOrders)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating orderData handler: %v\n", err)
	}
	uploadableBords := common.Filter(common.Keys(adj.Info.Addresses), func(item string) bool {
		return item != adj.Info.Addresses[BLCU]
	})
	programableBoardsHandle, err := h.HandleDataJSON("programableBoards.json", uploadableBords)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating programableBoards handler: %v\n", err)
	}

	for _, server := range config.Server {
		mux := h.NewMux(
			h.Endpoint("/backend"+server.Endpoints.PodData, podDataHandle),
			h.Endpoint("/backend"+server.Endpoints.OrderData, orderDataHandle),
			h.Endpoint("/backend"+server.Endpoints.ProgramableBoards, programableBoardsHandle),
			h.Endpoint(server.Endpoints.Connections, upgrader),
			h.Endpoint(server.Endpoints.Files, h.HandleStatic(server.StaticPath)),
		)

		httpServer := h.NewServer(server.Addr, mux)
		go httpServer.ListenAndServe()
	}

	go http.ListenAndServe("127.0.0.1:4040", nil)
}
